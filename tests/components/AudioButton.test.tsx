import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { AudioButton } from "@/components/AudioButton";

/** Flush several rounds of microtasks so async play() chain settles. */
async function flushMicrotasks(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(() => Promise.resolve());
  }
}

describe("AudioButton", () => {
  let speakMock: ReturnType<typeof vi.fn>;
  let cancelMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speakMock = vi.fn();
    cancelMock = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: speakMock,
        cancel: cancelMock,
        getVoices: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    // jsdom doesn't ship SpeechSynthesisUtterance — provide a minimal stub.
    class FakeUtterance {
      text: string;
      lang = "";
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      writable: true,
      value: FakeUtterance,
    });
  });
  afterEach(() => cleanup());

  it("falls back to speechSynthesis when audio playback rejects", async () => {
    // Every Audio.play() call rejects (local file + Google TTS).
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("404"));

    render(<AudioButton audioFile="missing.mp3" fallbackText="你好" />);

    await act(async () => {
      screen.getByRole("button").click();
    });

    await flushMicrotasks();

    expect(speakMock).toHaveBeenCalledTimes(1);
    const utter = speakMock.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utter.lang).toBe("zh-CN");
    expect(utter.text).toBe("你好");

    playSpy.mockRestore();
  });

  it("does not double-fire when both error event and play rejection fire", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(function (this: HTMLMediaElement) {
        // Dispatch error event synchronously, then reject — simulating a real 404.
        queueMicrotask(() => {
          this.dispatchEvent(new Event("error"));
        });
        return Promise.reject(new Error("NotSupportedError"));
      });

    render(<AudioButton audioFile="missing.mp3" fallbackText="你好" />);

    await act(async () => {
      screen.getByRole("button").click();
    });

    await flushMicrotasks();

    expect(speakMock).toHaveBeenCalledTimes(1);
    playSpy.mockRestore();
  });

  it("has an aria-label that includes the fallback text", () => {
    render(<AudioButton audioFile="x.mp3" fallbackText="谢谢" />);
    expect(
      screen.getByRole("button", { name: /谢谢/ })
    ).toBeInTheDocument();
  });
});
