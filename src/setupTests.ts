// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { installMatchMediaFake } from "./test/hoverCapability";

// jsdom does not implement scrollIntoView; CountryInput calls it in an effect
// when navigating suggestions. Stub it so tests don't hit an unhandled error.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom does not implement matchMedia; the map queries it for hover capability.
beforeEach(installMatchMediaFake);
