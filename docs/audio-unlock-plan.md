# Audio Unlock: Persistent Element Pattern

## Problem

Autoplay on the study page works intermittently on mobile (especially iOS Safari / installed PWA):

- `playWordAudio` logs `play OK` and `hasUserActivation: true`, yet no sound is heard.
- Behavior varies between sessions, cold vs. warm device, and first vs. subsequent words.

Two known iOS/WebKit rules explain the flakiness:

1. **Transient user activation is short-lived.** On iOS Safari, the activation granted by a tap often only survives the synchronous task that follows it. Our HSK-level button click is followed by `await db.words.where(...).sortBy("frequency")` and `await db.srsCards.toArray()` before the `useEffect` fires `playWordAudio`. By then the activation window can be gone.
2. **Activation does not transfer between `HTMLAudioElement` instances.** `tryPlayAudioFile` creates a `new Audio(src)` per word, and for cached entries calls `cloneNode().play()`. iOS WebKit treats each element as unprivileged unless it was itself unlocked by a user gesture.

Related (not addressed here): the iPhone silent (ring/mute) switch silences HTML5 `<audio>` unconditionally — `.play()` still resolves OK. That is a device-state issue; we can only surface it in UI, not fix it in code.

## Goal

Play word audio reliably on every card of a study session after a single tap, on iOS Safari, Android Chrome, and desktop browsers, with no regression to the manual `AudioButton`.

## Approach: persistent element, gesture-time unlock

Maintain **one** module-scoped `HTMLAudioElement` that is unlocked inside a user gesture and then reused for every subsequent play by swapping its `src`. This is the pattern used by Howler.js and most audio-heavy web apps.

### Why it works

- The unlock tap calls `.play()` on the element synchronously, inside the gesture. iOS marks that specific element as user-activated.
- Future `.play()` calls on the **same** element do not need a fresh gesture — the element remembers its unlocked state for the document's lifetime.
- Swapping `.src` does not reset the unlock.
- No `cloneNode` — clones are fresh elements and lose activation on iOS.

### Why our current code fails

- Creates a new `Audio` instance per word → no inherited unlock.
- Uses `cloneNode()` for cached entries → same problem.
- Relies on the activation granted by the HSK-level button surviving two `await`s and a React re-render → unreliable on iOS.

## Implementation plan

### 1. New singleton in `src/lib/audio.ts`

```ts
// Module-scoped singleton — created lazily on first unlock.
let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;

/**
 * Must be called from within a user-gesture handler (click/touchend).
 * Primes both the shared <audio> element and easy-speech for later
 * gesture-free playback. Safe to call multiple times.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
    sharedAudio.crossOrigin = "anonymous";
  }
  // 1×1 silent mp3 data URI — plays instantly, marks element as unlocked.
  sharedAudio.src = SILENT_MP3_DATA_URI;
  sharedAudio
    .play()
    .then(() => {
      sharedAudio!.pause();
      sharedAudio!.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {
      // Element still gets the activation benefit from the attempt.
      unlocked = true;
    });

  // Also unlock easy-speech in the same gesture.
  void speakChinese(" ").catch(() => {});
}
```

### 2. Replace `tryPlayAudioFile` playback path

- Always play through `sharedAudio` (create lazily if the unlock step was skipped — still works on desktop, degrades on iOS).
- Remove `cloneNode`; remove the per-call `new Audio(src)` path for known-cached entries.
- Keep the `audioCache` only as a "this URL is known-decodable" marker, not as an element cache.

```ts
export function tryPlayAudioFile(
  audioFile: string,
  opts?: { onEnded?: () => void; caller?: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    const src = `${import.meta.env.BASE_URL}audio/${audioFile}`;
    if (!sharedAudio) sharedAudio = new Audio();
    const el = sharedAudio;

    const onEnded = () => {
      opts?.onEnded?.();
      el.removeEventListener("ended", onEnded);
    };
    el.addEventListener("ended", onEnded, { once: true });

    el.src = src;
    el.currentTime = 0;
    el.play()
      .then(() => resolve(true))
      .catch((err) => {
        console.warn(`🔊 [${opts?.caller}] play FAIL`, err?.name, err?.message);
        resolve(false);
      });
  });
}
```

### 3. Call `unlockAudio()` from the HSK-level button

In `src/routes/study.tsx:88`, on the level-button `onClick`:

```tsx
onClick={() => {
  unlockAudio(); // synchronous, inside the gesture
  setSelectedLevel(level);
}}
```

This is the only place we need to explicitly unlock — every downstream autoplay reuses `sharedAudio`.

### 4. Keep `AudioButton` working

`AudioButton.play()` is already called inside a click handler, so it would keep working even without unlock. But to stay consistent, route it through the same `sharedAudio` singleton. No behavior change for users.

### 5. Handle the silent-switch edge case (optional, UX nice-to-have)

`.play()` resolves OK when the iPhone silent switch mutes the element, so we can't detect it server-side. Options:
- Display a small "🔇 check your silent switch" hint the first time a user enters study mode on iOS.
- Or: attach a one-shot `timeupdate` check after `.play()` — if `currentTime` stays at 0 for 300ms, show the hint.

Out of scope for this PR; tracked as follow-up.

## Files to change

| File | Change |
|------|--------|
| `src/lib/audio.ts` | Add `sharedAudio`, `unlocked`, `unlockAudio()`. Rewrite `tryPlayAudioFile` to use the singleton. Remove `audioCache` element-cache behavior. |
| `src/routes/study.tsx` | Call `unlockAudio()` from HSK-level `onClick` (line ~88). Keep existing autoplay `useEffect`. |
| `src/components/AudioButton.tsx` | No API change; internally routes through shared singleton via `tryPlayAudioFile`. |

## Testing checklist

- [ ] Desktop Chrome: first word autoplays after HSK-level tap. Subsequent words autoplay.
- [ ] Desktop Safari: same.
- [ ] iOS Safari (tab): same. Verify across cold/warm starts.
- [ ] iOS installed PWA (home-screen icon): same.
- [ ] Android Chrome: same.
- [ ] `AudioButton` manual tap still works on all above.
- [ ] Silent switch ON (iOS): `.play()` still resolves OK, no crash, no infinite-retry loop.
- [ ] Backgrounding the PWA and resuming: next-word autoplay still works.
- [ ] Service worker offline: cached mp3s still play through the singleton.
- [ ] Logs show `play OK` and audible sound match on every word.

## Rollout

1. Implement in a single commit on `mvp`.
2. Test locally on desktop + iOS Safari over the network via `npm run dev` exposed on LAN.
3. Deploy to GitHub Pages, re-test installed PWA.
4. Remove the verbose `🔊` console logs after one week of stability (or gate them behind a dev-only flag).

## References

- Transient user activation: https://developer.mozilla.org/en-US/docs/Web/Security/User_activation
- WebKit autoplay policy: https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/
- Howler.js unlock pattern: https://github.com/goldfire/howler.js/blob/master/src/howler.core.js (see `_unlockAudio`)
- iOS silent-switch behavior: https://bugs.webkit.org/show_bug.cgi?id=173332
