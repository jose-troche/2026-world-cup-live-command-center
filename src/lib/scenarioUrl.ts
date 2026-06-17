export type ScenarioChoice = "H" | "D" | "A";
export type ScenarioOverrides = Record<string, ScenarioChoice>;

export function encodeScenario(overrides: ScenarioOverrides): string {
  return Object.entries(overrides)
    .filter(([, v]) => v)
    .map(([id, v]) => `${encodeURIComponent(id)}:${v}`)
    .join(",");
}

export function decodeScenario(param: string): ScenarioOverrides {
  const result: ScenarioOverrides = {};
  for (const part of param.split(",")) {
    const idx = part.lastIndexOf(":");
    if (idx < 0) continue;
    const id = decodeURIComponent(part.slice(0, idx));
    const v = part.slice(idx + 1) as ScenarioChoice;
    if ((v === "H" || v === "D" || v === "A") && id) {
      result[id] = v;
    }
  }
  return result;
}
