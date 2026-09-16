import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import useThemeColor from "./useThemeColor";
import { COLORS } from "../tokens";

const meta = () => document.querySelector('meta[name="theme-color"]');
const content = () => meta()?.getAttribute("content");

describe("useThemeColor", () => {
  beforeEach(() => {
    meta()?.remove();
    const tag = document.createElement("meta");
    tag.setAttribute("name", "theme-color");
    // Whatever `index.html` happens to ship is not what is under test; what
    // matters is that the hook overwrites it either way.
    tag.setAttribute("content", "#000000");
    document.head.appendChild(tag);
  });

  it("stands the status bar on cream over a map surface", () => {
    renderHook(() => useThemeColor(true));

    expect(content()).toBe(COLORS.paper);
  });

  it("stands it on night over a content page", () => {
    renderHook(() => useThemeColor(false));

    expect(content()).toBe(COLORS.night);
  });

  it("follows the screen from one family to the other", () => {
    const { rerender } = renderHook(
      ({ onMap }: { onMap: boolean }) => useThemeColor(onMap),
      { initialProps: { onMap: false } },
    );
    expect(content()).toBe(COLORS.night);

    rerender({ onMap: true });

    expect(content()).toBe(COLORS.paper);
  });

  it("does nothing at all when the page has no theme-color tag", () => {
    meta()?.remove();

    // The tag lives in `index.html` and is decoration; a missing one must not
    // take the app down with it.
    expect(() => renderHook(() => useThemeColor(true))).not.toThrow();
    expect(meta()).toBeNull();
  });
});
