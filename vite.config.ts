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

const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "X-Content-Type-Options": "nosniff"
};

export default defineConfig({
  base: githubPagesBase,
  plugins: [react()],
  server: {
    headers: crossOriginIsolationHeaders
  },
  preview: {
    headers: crossOriginIsolationHeaders
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "tests/browser/**"]
  }
});
