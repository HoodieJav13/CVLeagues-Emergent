import { exportStatus, sha256OfUrl, startExport } from "./replayIO";

const response = (status, type, body = "abc") => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (h) => (h.toLowerCase() === "content-type" ? type : null) },
  arrayBuffer: async () => {
    // Node WebCrypto needs the Node realm's ArrayBuffer when jsdom supplies globals.
    const bytes = Buffer.from(body);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  },
});

describe("sha256OfUrl", () => {
  const realFetch = global.fetch;
  const realCrypto = global.crypto;
  beforeAll(() => {
    // jsdom lacks SubtleCrypto; use Node's for this unit.
    Object.defineProperty(global, "crypto", { value: require("crypto").webcrypto, configurable: true });
  });
  afterAll(() => {
    global.fetch = realFetch;
    Object.defineProperty(global, "crypto", { value: realCrypto, configurable: true });
  });

  test("a 404 is missing footage", async () => {
    global.fetch = jest.fn(async () => response(404, "text/html"));
    await expect(sha256OfUrl("/replay-media/x.webm")).resolves.toEqual({ missing: true });
  });

  test("the dev server's HTML fallback (200 text/html) is missing footage, not replaced footage", async () => {
    global.fetch = jest.fn(async () => response(200, "text/html; charset=utf-8", "<!doctype html>"));
    await expect(sha256OfUrl("/replay-media/x.webm")).resolves.toEqual({ missing: true });
  });

  test("a video response is hashed with SHA-256", async () => {
    global.fetch = jest.fn(async () => response(200, "video/webm", "abc"));
    await expect(sha256OfUrl("/replay-media/x.webm")).resolves.toEqual({
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", bytes: 3,
    });
  });
});

describe("export helper client (review R3)", () => {
  const realFetch = global.fetch;
  afterAll(() => { global.fetch = realFetch; });
  test("a helper that went away turns into a recoverable failure, not a stuck render", async () => {
    global.fetch = jest.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(startExport({})).resolves.toMatchObject({ state: "failed", code: "HELPER" });
    await expect(exportStatus("x")).resolves.toMatchObject({ state: "failed", code: "HELPER" });
  });
});
