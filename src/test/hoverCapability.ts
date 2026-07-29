// jsdom implements no `matchMedia`, but the map needs one: it asks whether the
// device has a hovering pointer to decide between commit-on-click (mouse) and
// tap-to-preview-then-commit (touch). Tests flip the answer with
// `setHoverCapability(false)`; the default is a desktop-like hovering pointer.

let hasHover = true;

export function setHoverCapability(value: boolean): void {
  hasHover = value;
}

export function installMatchMediaFake(): void {
  hasHover = true;
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes("hover: hover") ? hasHover : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
