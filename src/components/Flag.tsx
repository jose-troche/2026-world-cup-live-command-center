import { useState } from "react";
import type { Team } from "../types";

type FlagProps = {
  team?: Team;
  size?: "sm" | "md" | "lg";
};

export function Flag({ team, size = "md" }: FlagProps) {
  const [failed, setFailed] = useState(false);
  const initials = team?.code?.slice(0, 3) ?? "TBD";

  if (!team || failed) {
    return <span className={`flag flag-${size} flag-fallback`}>{initials}</span>;
  }

  return (
    <span className={`flag flag-${size}`}>
      <img src={team.flag} alt={`${team.name} flag`} onError={() => setFailed(true)} />
    </span>
  );
}
