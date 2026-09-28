// The Vite plugin keeps modal-x out of Vite's dep pre-bundling, so dev loads a
// single copy of the library and its import.meta.glob modal scan is transformed.
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { modalTypesPlugin } = require("../modalxPlugin.cjs");

describe("modalTypesPlugin", () => {
  it("excludes modal-x (and its router subpath) from dep pre-bundling", () => {
    const { optimizeDeps } = modalTypesPlugin().config();
    expect(optimizeDeps.exclude).toEqual(
      expect.arrayContaining(["@customizer/modal-x", "@customizer/modal-x/router"]),
    );
  });
});
