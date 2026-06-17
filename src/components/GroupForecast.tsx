import { useEffect, useMemo, useState } from "react";
import { BarChart3, FlaskConical, Info, Sparkles } from "lucide-react";
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
import { simulateAdvancement } from "../lib/analytics";
import type { Group, Match, Team } from "../types";
import { Flag } from "./Flag";
import { ScenarioSimulator } from "./ScenarioSimulator";
import { ShareButtons } from "./ShareButtons";

type Props = {
  groups: Group[];
  matches: Match[];
  teams: Team[];
  selectedGroupName?: string;
  initialScenario?: string;
};

export function GroupForecast({ groups, matches, teams, selectedGroupName, initialScenario }: Props) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.name ?? "A");
  const [scenarioMode, setScenarioMode] = useState(Boolean(initialScenario));
  const probabilities = useMemo(
    () => simulateAdvancement(groups, matches, teams),
    [groups, matches, teams],
  );
  const group = groups.find((item) => item.name === selectedGroup) ?? groups[0];
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  useEffect(() => {
    if (selectedGroupName && groups.some((item) => item.name === selectedGroupName)) {
      setSelectedGroup(selectedGroupName);
    }
  }, [groups, selectedGroupName]);

  if (!group) return <div className="empty-state panel">Loading group standings…</div>;

  const rows = [...group.standings]
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference)
    .map((standing) => ({
      ...standing,
      team: teamById.get(standing.teamId),
      probability: probabilities.get(standing.teamId) ?? 0,
    }));

  const chartData = rows.map((row) => ({
    name: row.team?.code ?? row.teamId,
    probability: row.probability,
  }));

  return (
    <div className="lab-stack">
      <section className="lab-intro">
        <div>
          <span className="eyebrow">Qualification model</span>
          <h2>Group advancement outlook</h2>
          <p>We simulate every remaining group fixture 700 times, including qualification through the eight best third-place positions.</p>
        </div>
        <div className="model-badge"><Sparkles size={16} /> 700 simulations</div>
        <div className="insight-share-row">
          <ShareButtons title="Group stage advancement odds — Touchline 26" url={`${window.location.origin}/groups`} />
        </div>
      </section>

      <div className="scenario-toggle-row">
        <div className="group-tabs" aria-label="Select group">
          {groups.map((item) => (
            <button
              className={item.name === group.name ? "active" : ""}
              onClick={() => setSelectedGroup(item.name)}
              key={item.name}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button
          className={`scenario-toggle-btn${scenarioMode ? " active" : ""}`}
          onClick={() => setScenarioMode((v) => !v)}
        >
          <FlaskConical size={14} />
          {scenarioMode ? "Exit scenario" : "What if…?"}
        </button>
      </div>

      {scenarioMode && (
        <ScenarioSimulator
          groups={groups}
          matches={matches}
          teams={teams}
          selectedGroup={selectedGroup}
          initialScenario={initialScenario}
        />
      )}

      {!scenarioMode && <section className="forecast-grid">
        <article className="panel table-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Live standings</span>
              <h3>Group {group.name}</h3>
            </div>
            <BarChart3 size={19} />
          </div>
          <div className="standings-table">
            <div className="table-row table-head">
              <span>#</span><span>Team</span><span>PL</span><span>GD</span><span>Pts</span><span>Qualify</span>
            </div>
            {rows.map((row, index) => (
              <div className="table-row" key={row.teamId}>
                <span className={`position position-${index + 1}`}>{index + 1}</span>
                <span className="standing-team"><Flag team={row.team} size="sm" />{row.team?.name ?? row.teamId}</span>
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
          <div className="qualification-key">
            <span><i className="direct" /> First and second qualify automatically</span>
            <span><i className="third" /> Eight best third-place teams also advance</span>
          </div>
        </article>

        <article className="panel forecast-chart">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Model projection</span>
              <h3>Probability of qualification</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={315}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24, top: 10 }}>
              <CartesianGrid stroke="#26312e" strokeDasharray="3 5" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" stroke="#b7c1bd" tickLine={false} axisLine={false} width={44} />
              <Tooltip
                cursor={{ fill: "rgba(217,255,67,.04)" }}
                formatter={(value) => [`${value}%`, "Qualification probability"]}
                contentStyle={{ background: "#101b17", border: "1px solid #2a3933", borderRadius: 12 }}
              />
              <Bar dataKey="probability" radius={[0, 8, 8, 0]} barSize={30}>
                {chartData.map((entry, index) => (
                  <Cell fill={index < 2 ? "#d9ff43" : index === 2 ? "#f1b84b" : "#53605b"} key={entry.name} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="model-note"><Info size={14} /> Projections update with the standings and are not betting advice.</p>
        </article>
      </section>}
    </div>
  );
}
