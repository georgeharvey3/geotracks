import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(_on, _config) {},
    defaultCommandTimeout: 15000,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
});
