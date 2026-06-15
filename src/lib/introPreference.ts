export const INTRO_PREFERENCE_KEY = "touchline26:hide-intro";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function shouldHideIntro(storage?: StorageLike) {
  try {
    return storage?.getItem(INTRO_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveIntroPreference(hide: boolean, storage?: StorageLike) {
  try {
    if (hide) storage?.setItem(INTRO_PREFERENCE_KEY, "true");
    else storage?.removeItem(INTRO_PREFERENCE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}
