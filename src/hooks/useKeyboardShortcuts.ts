import { useEffect, useRef } from "react";

interface KeyboardShortcuts {
  inputRef: React.RefObject<HTMLInputElement>;
  // Toggle playback (Space).
  onPlay: () => void;
  // Advance to the next song (Enter); a no-op mid-round is fine.
  onNext: () => void;
}

/**
 * Global keyboard shortcuts for the game screen:
 *  - Space: toggle playback
 *  - Enter: next song
 *  - any other key while unfocused: focus the country input
 *  - Escape: blur the country input
 *
 * Callbacks are held in refs so the document-level listeners always call the
 * latest version without re-registering on every render.
 */
export default function useKeyboardShortcuts({
  inputRef,
  onPlay,
  onNext,
}: KeyboardShortcuts): void {
  const onPlayRef = useRef(onPlay);
  const onNextRef = useRef(onNext);

  useEffect(() => {
    onPlayRef.current = onPlay;
    onNextRef.current = onNext;
  }, [onPlay, onNext]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement === inputRef.current;
      if (isInputFocused) return;

      if (e.key === " ") {
        onPlayRef.current();
        return;
      }
      if (e.key === "Enter") {
        onNextRef.current();
        return;
      }
      inputRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keypress", handleKeyPress);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keypress", handleKeyPress);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef]);
}
