import react from "@vitejs/plugin-react";
import { createReadStream, copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const onnxRuntimeDistDir = dirname(
  require.resolve("onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs")
);
const onnxRuntimePublicPath = "/ort/";
const onnxRuntimeFiles = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm"
] as const;

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

function onnxRuntimeAssetsPlugin(): Plugin {
  return {
    name: "pitch-coach-onnx-runtime-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "";
        if (!pathname.startsWith(onnxRuntimePublicPath)) {
          next();
          return;
        }

        const fileName = pathname.slice(onnxRuntimePublicPath.length);
        if (!isOnnxRuntimeFile(fileName)) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", getOnnxRuntimeContentType(fileName));
        response.setHeader("Cache-Control", "no-cache");
        createReadStream(getOnnxRuntimeFilePath(fileName)).on("error", next).pipe(response);
      });
    },
    writeBundle(options) {
      const outputDir = options.dir ?? "dist";
      const targetDir = join(outputDir, onnxRuntimePublicPath);
      mkdirSync(targetDir, { recursive: true });
      onnxRuntimeFiles.forEach((fileName) => {
        copyFileSync(getOnnxRuntimeFilePath(fileName), join(targetDir, fileName));
      });
    }
  };
}

function isOnnxRuntimeFile(fileName: string): fileName is (typeof onnxRuntimeFiles)[number] {
  return onnxRuntimeFiles.includes(fileName as (typeof onnxRuntimeFiles)[number]);
}

function getOnnxRuntimeFilePath(fileName: (typeof onnxRuntimeFiles)[number]) {
  return join(onnxRuntimeDistDir, fileName);
}

function getOnnxRuntimeContentType(fileName: (typeof onnxRuntimeFiles)[number]) {
  return fileName.endsWith(".wasm") ? "application/wasm" : "application/javascript";
}

export default defineConfig({
  base: githubPagesBase,
  plugins: [react(), onnxRuntimeAssetsPlugin()],
  resolve: {
    conditions: ["onnxruntime-web-use-extern-wasm"]
  },
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
