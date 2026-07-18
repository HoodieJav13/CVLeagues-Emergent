import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  STORAGE_VERSION,
  initialState,
  loadMockState,
  persistMockState,
  resetMockState,
} from "./mockState";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) ?? null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
    values,
  };
};

describe("development mock-state persistence", () => {
  test("persists and reloads a versioned valid envelope", () => {
    const storage = memoryStorage();
    const state = { ...initialState, settings: { ...initialState.settings, hof_published: true } };

    persistMockState(storage, state);
    const loaded = loadMockState(storage);

    expect(JSON.parse(storage.values.get(STORAGE_KEY))).toMatchObject({ version: STORAGE_VERSION });
    expect(loaded.settings.hof_published).toBe(true);
  });

  test.each([
    ["invalid JSON", "{"],
    ["wrong version", JSON.stringify({ version: STORAGE_VERSION - 1, state: initialState })],
    ["structurally incomplete state", JSON.stringify({ version: STORAGE_VERSION, state: { settings: {} } })],
  ])("reseeds and removes %s", (_name, value) => {
    const storage = memoryStorage();
    storage.values.set(STORAGE_KEY, value);

    expect(loadMockState(storage)).toBe(initialState);
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });

  test("migrates the immediately previous fixture shape and removes every legacy key", () => {
    const storage = memoryStorage();
    const previousKey = LEGACY_STORAGE_KEYS.at(-1);
    const previous = JSON.parse(JSON.stringify(initialState));
    delete previous.playoffBrackets;
    delete previous.playoffSeeds;
    delete previous.playoffMatches;
    delete previous.registrations[0].preferred_season;
    storage.values.set(previousKey, JSON.stringify(previous));
    storage.values.set(LEGACY_STORAGE_KEYS[0], "abandoned");

    const loaded = loadMockState(storage);

    expect(loaded.playoffBrackets).toEqual(initialState.playoffBrackets);
    expect(loaded.registrations[0].preferred_season).toBe(initialState.settings.current_season);
    expect(JSON.parse(storage.values.get(STORAGE_KEY)).version).toBe(STORAGE_VERSION);
    expect(LEGACY_STORAGE_KEYS.every((key) => !storage.values.has(key))).toBe(true);
  });

  test("reset removes current and legacy state before returning pristine fixtures", () => {
    const storage = memoryStorage();
    storage.values.set(STORAGE_KEY, "current");
    LEGACY_STORAGE_KEYS.forEach((key) => storage.values.set(key, "legacy"));

    expect(resetMockState(storage)).toBe(initialState);
    expect(storage.values.size).toBe(0);
  });
});
