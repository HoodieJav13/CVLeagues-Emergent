import { sha256OfUrl } from "./replayIO";

const response = (status, type, body = "abc") => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (h) => (h.toLowerCase() === "content-type" ? type : null) },
  arrayBuffer: async () => Uint8Array.from(Buffer.from(body)).buffer,
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
