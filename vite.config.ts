import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const githubPagesBase =
  process.env.GITHUB_PAGES === "true"
    ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "pitch_coach"}/`
    : "/";

export default defineConfig({
  base: githubPagesBase,
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "tests/browser/**"]
  }
});
