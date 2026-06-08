import { describe, expect, it } from "vitest";
import { getOnnxRuntimeWasmPaths } from "./vocalSeparation";

describe("vocal separation runtime assets", () => {
  it("loads ONNX Runtime Web from app-hosted external assets", () => {
    expect(getOnnxRuntimeWasmPaths()).toEqual({
      mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
      wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm"
    });
  });
});
