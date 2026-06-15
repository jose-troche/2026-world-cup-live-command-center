import { describe, expect, it } from "vitest";
import {
  INTRO_PREFERENCE_KEY,
  saveIntroPreference,
  shouldHideIntro,
} from "./introPreference";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("intro preference", () => {
  it("shows the intro when no preference exists", () => {
    expect(shouldHideIntro(memoryStorage())).toBe(false);
  });

  it("persists the choice to hide future intros", () => {
    const storage = memoryStorage();
    saveIntroPreference(true, storage);
    expect(storage.getItem(INTRO_PREFERENCE_KEY)).toBe("true");
    expect(shouldHideIntro(storage)).toBe(true);
  });

  it("allows the user to restore the intro", () => {
    const storage = memoryStorage();
    saveIntroPreference(true, storage);
    saveIntroPreference(false, storage);
    expect(shouldHideIntro(storage)).toBe(false);
  });
});
