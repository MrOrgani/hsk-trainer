---
name: hanziwriter
description: Reference for the hanzi-writer library API — use when creating, modifying, or debugging components that render, animate, or quiz Chinese character strokes
---

# Hanzi Writer Skill

Use this skill when working with hanzi-writer in the HSK Trainer project. The full API docs live at `docs/hanziwriter.md` — read that file for complete details.

## Quick Reference

### Creating a Writer

```javascript
const writer = HanziWriter.create(element, character, options);
```

- `element` — DOM node or element ID
- `character` — single Chinese character string
- `options` — config object (width, height, padding, colors, etc.)

### Key Options

| Option | Default | Notes |
|--------|---------|-------|
| `width` / `height` | - | Required. Canvas size in px |
| `padding` | `20` | Space between character and edge |
| `showCharacter` | `true` | Show character on first render |
| `showOutline` | `true` | Show gray outline |
| `strokeColor` | `'#555'` | Rendered stroke color |
| `outlineColor` | `'#DDD'` | Outline color |
| `drawingColor` | `'#333'` | User drawing color |
| `highlightColor` | `'#AAF'` | Quiz hint highlight |
| `radicalColor` | `null` | Radical highlight color |
| `strokeAnimationSpeed` | `1` | Speed multiplier |
| `delayBetweenStrokes` | `1000` | Ms between strokes in animation |
| `renderer` | `'svg'` | `'svg'` or `'canvas'` |

### Animation

```javascript
writer.animateCharacter({ onComplete: () => {} }); // returns Promise
writer.loopCharacterAnimation();
writer.animateStroke(strokeNum, { onComplete });
writer.pauseAnimation();
writer.resumeAnimation();
```

### Quiz Mode

```javascript
writer.quiz({
  onMistake(strokeData) {},      // { strokeNum, mistakesOnStroke, totalMistakes, strokesRemaining, drawnPath }
  onCorrectStroke(strokeData) {}, // same shape
  onComplete(summaryData) {},     // { character, totalMistakes }
  showHintAfterMisses: 3,
  markStrokeCorrectAfterMisses: undefined, // disabled by default
  acceptBackwardsStrokes: false,
  leniency: 1.0,                 // 0 = strictest
  highlightOnComplete: true,
  quizStartStrokeNum: 0,
});

writer.cancelQuiz();
```

### Show / Hide / Color

```javascript
writer.showCharacter({ duration: 300, onComplete });
writer.hideCharacter({ duration: 300, onComplete });
writer.showOutline({ duration, onComplete });
writer.hideOutline({ duration, onComplete });
writer.updateColor('strokeColor', '#FF0000', { duration, onComplete });
```

### Character Switching & Resize

```javascript
writer.setCharacter('新');  // replaces character, resets quiz/animation
writer.updateDimensions({ width: 200, height: 200, padding: 10 });
```

### Loading Character Data (for raw SVG)

```javascript
HanziWriter.loadCharacterData('六').then(charData => {
  // charData.strokes — array of SVG path strings
});

HanziWriter.getScalingTransform(width, height, padding);
// returns { x, y, scale, transform }
```

### Custom Data Loading

```javascript
HanziWriter.create('target', '人', {
  charDataLoader: function(char, onComplete) {
    // return charData object or call onComplete(charData)
  },
  onLoadCharDataSuccess: (data) => {},
  onLoadCharDataError: (reason) => {},
});
```

## Project-Specific Patterns

### React Integration (imperative library)

We bridge hanzi-writer into React via refs + useEffect. Key patterns used in this codebase:

1. **Ref-stabilize callbacks** to prevent writer recreation on parent re-render:
   ```tsx
   const onCompleteRef = useRef(onComplete);
   onCompleteRef.current = onComplete;
   // Effect deps: [character, size] — NOT onComplete
   ```

2. **Cleanup on unmount**: call `writer.cancelQuiz()` in the effect cleanup.

3. **DOM target**: use `target.replaceChildren()` (NOT `innerHTML = ""`) to clear before recreating.

4. **Touch support**: set `style.touchAction = "none"` on the container div for mobile drawing.

5. **Key prop for remount**: when switching characters, use `key={character}` or `key={\`${wordId}:${charIndex}\`}` on the wrapper component to force a clean unmount/remount cycle.

### Relevant Components

- `src/components/DrawingCanvas.tsx` — quiz mode wrapper (green strokes)
- `src/components/StrokeAnimation.tsx` — animation mode wrapper (sky strokes)
- `src/components/WritingPrompt.tsx` — multi-character writing flow
- `src/test-utils/hanzi-writer-mock.ts` — test fake with `FakeWriter` interface

### Testing

The `installHanziWriterMock()` helper replaces the real library. Tests drive quiz callbacks via:
```ts
fakeWriters[0].lastQuizOptions.onMistake?.();
fakeWriters[0].lastQuizOptions.onComplete?.();
```
