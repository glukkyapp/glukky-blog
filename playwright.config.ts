import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5000",
  },
  projects: [
    {
      name: "api",
      use: {},
    },
  ],
});
