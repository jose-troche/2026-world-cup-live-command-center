import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Copy, FlaskConical } from "lucide-react";
import { simulateAdvancement } from "../lib/analytics";
import { buildGroupStandings } from "../lib/standings";
import { decodeScenario, encodeScenario } from "../lib/scenarioUrl";
import type { Group, Match, Team } from "../types";
import { Flag } from "./Flag";

type Choice = "H" | "D" | "A";

type Props = {
  groups: Group[];
  matches: Match[];
  teams: Team[];
  selectedGroup: string;
  initialScenario?: string;
};

function applyOverride(match: Match, choice: Choice): Match {
  if (choice === "H") return { ...match, status: "finished", homeScore: 1, awayScore: 0 };
  if (choice === "A") return { ...match, status: "finished", homeScore: 0, awayScore: 1 };
  return { ...match, status: "finished", homeScore: 0, awayScore: 0 };
}

export function ScenarioSimulator({ groups, matches, teams, selectedGroup, initialScenario }: Props) {
  const [overrides, setOverrides] = useState<Record<string, Choice>>(() => {
    if (initialScenario) return decodeScenario(initialScenario);
    return {};
  });
  const [copied, setCopied] = useState(false);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const pendingGroupMatches = useMemo(
    () => matches.filter((m) => m.group === selectedGroup && m.status === "scheduled"),
    [matches, selectedGroup],
  );

  const scenarioMatches = useMemo(() => {
    return matches.map((m) => {
      const choice = overrides[m.id];
      return choice ? applyOverride(m, choice) : m;
    });
  }, [matches, overrides]);

  const scenarioGroups = useMemo(
    () => buildGroupStandings(teams, scenarioMatches),
    [teams, scenarioMatches],
  );

  const advancementProbs = useMemo(
    () => simulateAdvancement(scenarioGroups, scenarioMatches, teams, 300),
    [scenarioGroups, scenarioMatches, teams],
  );

  const currentGroup = scenarioGroups.find((g) => g.name === selectedGroup);
  const rows = useMemo(() => {
    if (!currentGroup) return [];
    return [...currentGroup.standings]
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference)
      .map((s) => ({
        ...s,
        team: teamById.get(s.teamId),
        probability: advancementProbs.get(s.teamId) ?? 0,
      }));
  }, [currentGroup, teamById, advancementProbs]);

  const chartData = rows.map((r) => ({
    name: r.team?.code ?? r.teamId.slice(0, 3),
    probability: r.probability,
  }));

  function toggle(matchId: string, choice: Choice) {
    setOverrides((prev) => {
      if (prev[matchId] === choice) {
        const next = { ...prev };
        delete next[matchId];
        return next;
      }
      return { ...prev, [matchId]: choice };
    });
  }

  function resetGroup() {
    const groupMatchIds = new Set(pendingGroupMatches.map((m) => m.id));
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of groupMatchIds) delete next[id];
      return next;
    });
  }

  function copyScenario() {
    const param = encodeScenario(overrides);
    const url = `${window.location.origin}/groups?scenario=${param}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasAnyOverride = Object.keys(overrides).length > 0;

  return (
    <div className="panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Scenario mode</span>
          <h3><FlaskConical size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />What if…?</h3>
        </div>
        {hasAnyOverride && (
          <button className="scenario-toggle-btn" onClick={resetGroup}>
            Reset group
          </button>
        )}
      </div>

      {pendingGroupMatches.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>All Group {selectedGroup} matches have been played.</p>
      ) : (
        <div className="scenario-match-list">
          {pendingGroupMatches.map((match) => {
            const active = overrides[match.id];
            const homeTeam = teamById.get(match.homeId);
            const awayTeam = teamById.get(match.awayId);
            return (
              <div key={match.id} className="scenario-match-row">
                <div className="scenario-match-teams">
                  <Flag team={homeTeam} size="sm" />
                  {homeTeam?.code ?? match.homeName.slice(0, 3)}
                  <span style={{ margin: "0 6px", color: "var(--muted)" }}>vs</span>
                  <Flag team={awayTeam} size="sm" />
                  {awayTeam?.code ?? match.awayName.slice(0, 3)}
                </div>
                <div className="scenario-choice-group">
                  {[
                    { key: "H" as Choice, label: homeTeam?.code ?? "HW" },
                    { key: "D" as Choice, label: "Draw" },
                    { key: "A" as Choice, label: awayTeam?.code ?? "AW" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`scenario-choice-btn${active === key ? " active" : ""}`}
                      onClick={() => toggle(match.id, key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="standings-table" style={{ marginTop: 4 }}>
        <div className="table-row table-head">
          <span>#</span><span>Team</span><span>PL</span><span>GD</span><span>Pts</span><span>Qualify</span>
        </div>
        {rows.map((row, index) => (
          <div className="table-row" key={row.teamId}>
            <span className={`position position-${index + 1}`}>{index + 1}</span>
            <span className="standing-team">
              <Flag team={row.team} size="sm" />{row.team?.name ?? row.teamId}
            </span>
            <span>{row.played}</span>
            <span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
            <strong>{row.points}</strong>
            <span className="advance-cell">
              <i><b style={{ width: `${row.probability}%` }} /></i>
              <strong>{row.probability}%</strong>
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24, top: 6 }}>
          <CartesianGrid stroke="#26312e" strokeDasharray="3 5" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" stroke="#b7c1bd" tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ fill: "rgba(217,255,67,.04)" }}
            formatter={(value) => [`${value}%`, "Qualification probability"]}
            contentStyle={{ background: "#101b17", border: "1px solid #2a3933", borderRadius: 12 }}
          />
          <Bar dataKey="probability" radius={[0, 8, 8, 0]} barSize={26}>
            {chartData.map((entry, index) => (
              <Cell fill={index < 2 ? "#d9ff43" : index === 2 ? "#f1b84b" : "#53605b"} key={entry.name} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="scenario-share-row">
        <button className="share-pill" onClick={copyScenario}>
          <Copy size={12} /> {copied ? "Copied!" : "Copy scenario link"}
        </button>
        <span className="scenario-share-note">Share this exact scenario with anyone.</span>
      </div>
    </div>
  );
}
