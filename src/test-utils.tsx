import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

function renderWithTheme(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Match an element by the text it *reads as*, across its children.
 *
 * `getByText("4/10")` only ever sees an element's own text nodes, so a reading
 * split for emphasis — the standings plaque draws its "/10" a size down —
 * matches nothing. This compares the whole subtree instead, which stays unique
 * because the ancestors carry more text than the reading being looked for.
 */
export const readsAs = (reading: string) => (_: string, el: Element | null) =>
  el?.textContent === reading;

export * from "@testing-library/react";
export { renderWithTheme as render };
