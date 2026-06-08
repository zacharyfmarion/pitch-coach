# Song Mode Cloudflare ONNX Runtime

## Goal

Make Cloudflare Pages song mode load ONNX Runtime Web cleanly in production without worker threads importing the React app bundle.

## Approach

Use ONNX Runtime Web's external WASM runtime, serve the required runtime `.mjs` and `.wasm` files from the app origin, configure the song separator to point ORT at those files, and document the remaining Cloudflare/R2 deployment requirements.

## Affected Areas

- `vite.config.ts`
- `src/song/vocalSeparation.ts`
- `src/song/vocalSeparation.test.ts`
- `README.md`
- `implementation-plans/`

## Checklist

- [x] Serve/copy ONNX Runtime external assets for dev and production builds
- [x] Configure ORT WebGPU to use the app-hosted external runtime paths
- [x] Document the production song-mode deployment requirements
- [x] Validate build and targeted tests
