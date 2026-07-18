const ORIGINAL_ENV = process.env;

function loadConfig({ nodeEnv = "development", url = "", key = "", turnstile = "" } = {}) {
  jest.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: nodeEnv,
    REACT_APP_SUPABASE_URL: url,
    REACT_APP_SUPABASE_ANON_KEY: key,
    REACT_APP_TURNSTILE_SITE_KEY: turnstile,
  };
  jest.doMock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => ({ mode: "hosted" })) }));
  return require("./supabase");
}

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("frontend data-mode boundary", () => {
  test("development with no backend configuration explicitly selects mock mode", () => {
    const config = loadConfig();
    expect(config).toMatchObject({ BACKEND_ENABLED: false, MOCK_MODE: true, CONFIG_ERROR: null, supabase: null });
  });

  test("partial development configuration fails closed instead of loading fixtures", () => {
    const config = loadConfig({ url: "https://example.supabase.co" });
    expect(config.BACKEND_ENABLED).toBe(false);
    expect(config.MOCK_MODE).toBe(false);
    expect(config.CONFIG_ERROR).toMatch(/incomplete/i);
  });

  test("production with no backend configuration fails closed", () => {
    const config = loadConfig({ nodeEnv: "production" });
    expect(config.BACKEND_ENABLED).toBe(false);
    expect(config.MOCK_MODE).toBe(false);
    expect(config.CONFIG_ERROR).toMatch(/missing its Supabase/i);
  });

  test("production refuses hosted mode when abuse protection is missing", () => {
    const config = loadConfig({ nodeEnv: "production", url: "https://example.supabase.co", key: "public-key" });
    expect(config.BACKEND_ENABLED).toBe(false);
    expect(config.MOCK_MODE).toBe(false);
    expect(config.CONFIG_ERROR).toMatch(/abuse-protection/i);
  });

  test("complete production configuration enables only hosted mode", () => {
    const config = loadConfig({
      nodeEnv: "production",
      url: "https://example.supabase.co",
      key: "public-key",
      turnstile: "public-site-key",
    });
    expect(config.BACKEND_ENABLED).toBe(true);
    expect(config.MOCK_MODE).toBe(false);
    expect(config.CONFIG_ERROR).toBeNull();
    expect(config.supabase).toEqual({ mode: "hosted" });
  });
});
