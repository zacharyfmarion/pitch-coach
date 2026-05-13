import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const githubPagesBase =
  process.env.GITHUB_PAGES === "true"
    ? normalizeBasePath(
        process.env.GITHUB_PAGES_BASE_PATH ?? process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "pitch-coach"
      )
    : "/";

function normalizeBasePath(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

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
