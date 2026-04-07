// Cypress E2E support file
// Loaded before every E2E spec

// Prevent uncaught exceptions from Spotify embeds from failing tests
Cypress.on("uncaught:exception", (err) => {
  // Spotify embed can throw errors we don't control
  if (
    err.message.includes("spotify") ||
    err.message.includes("postMessage") ||
    err.message.includes("cross-origin")
  ) {
    return false;
  }
});
