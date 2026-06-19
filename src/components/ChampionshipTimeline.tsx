import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useChampionshipTimeline } from "../hooks/useChampionshipTimeline";
import type { Team } from "../types";
import { ShareButtons } from "./ShareButtons";

type FilterMode = "top5" | "top10" | "custom";

const TEAM_COLORS = [
  "#d9ff43", "#ff7043", "#f1b84b", "#4dd0e1", "#ce93d8",
  "#ef9a9a", "#80cbc4", "#fff176", "#ffab91", "#b0bec5",
  "#a5d6a7",
];

type Props = {
  teams: Team[];
};

export function ChampionshipTimeline({ teams }: Props) {
  const { snapshots, loading } = useChampionshipTimeline();
  const [filterMode, setFilterMode] = useState<FilterMode>("top5");
  const [customTeamId, setCustomTeamId] = useState<string>("");
  const [extraTeamId, setExtraTeamId] = useState<string>("");

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Latest snapshot to determine top-ranked teams
  const latestProbs = useMemo<[string, number][]>(() => {
    if (!snapshots.length) return [];
    return [...(snapshots[0]?.probabilities ?? [])].sort((a, b) => b[1] - a[1]);
  }, [snapshots]);

  const visibleTeamIds = useMemo<string[]>(() => {
    if (filterMode === "custom") {
      return customTeamId ? [customTeamId] : latestProbs.slice(0, 5).map(([id]) => id);
    }
    const base =
      filterMode === "top10"
        ? latestProbs.slice(0, 10).map(([id]) => id)
        : latestProbs.slice(0, 5).map(([id]) => id);
    if (extraTeamId && !base.includes(extraTeamId)) return [...base, extraTeamId];
    return base;
  }, [filterMode, customTeamId, extraTeamId, latestProbs]);

  // Build Recharts data: oldest snapshot first, columns are teamIds
  const chartData = useMemo(() => {
    return [...snapshots].reverse().map((snap) => {
      const probMap = new Map(snap.probabilities);
      const point: Record<string, string | number> = { label: snap.matchLabel };
      for (const id of visibleTeamIds) {
        point[id] = probMap.get(id) ?? 0;
      }
      return point;
    });
  }, [snapshots, visibleTeamIds]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/timeline` : "";
  const top3 = latestProbs
    .slice(0, 3)
    .map(([id]) => teamById.get(id)?.name ?? id)
    .join(", ");
  const shareTitle = top3
    ? `2026 World Cup title race — ${top3} lead — Touchline 26`
    : "2026 World Cup championship odds — Touchline 26";

  const heading = (eyebrow: string) => (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h3><TrendingUp size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Title race</h3>
      </div>
      <div className="insight-share-row">
        <ShareButtons title={shareTitle} url={shareUrl} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="timeline-panel panel">
        {heading("Tournament odds")}
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 32 }}>Loading…</p>
      </div>
    );
  }

  if (!snapshots.length || snapshots.length < 2) {
    return (
      <div className="timeline-panel panel">
        {heading("Tournament odds")}
        <div className="timeline-empty">
          <TrendingUp size={32} color="var(--muted)" />
          <strong>Timeline builds as matches complete</strong>
          <p style={{ margin: 0, fontSize: 13, maxWidth: 360 }}>
            After each match, championship probabilities are snapshotted here.
            Check back as the group stage progresses.
          </p>
          {snapshots.length === 1 && (
            <div style={{ width: "100%", marginTop: 16 }}>
              <p style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 12 }}>Current championship odds (top 10)</p>
              {latestProbs.slice(0, 10).map(([id, pct], i) => {
                const team = teamById.get(id);
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 28, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", textAlign: "right" }}>{i + 1}.</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{team?.name ?? id}</span>
                    <div style={{ width: 120, height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct * 3, 100)}%`, background: "var(--lime)", borderRadius: 3 }} />
                    </div>
                    <span style={{ width: 36, textAlign: "right", fontSize: 12, fontFamily: "var(--mono)", color: "var(--lime)" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-panel panel">
      {heading("Tournament odds over time")}

      <div className="timeline-filter-row">
        {(["top5", "top10", "custom"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            className={`hype-filter-btn${filterMode === mode ? " active" : ""}`}
            onClick={() => setFilterMode(mode)}
          >
            {mode === "top5" ? "Top 5" : mode === "top10" ? "Top 10" : "Pick a team"}
          </button>
        ))}
        {filterMode === "custom" && (
          <select
            className="timeline-team-select"
            value={customTeamId}
            onChange={(e) => setCustomTeamId(e.target.value)}
          >
            <option value="">Select team…</option>
            {latestProbs.map(([id]) => {
              const team = teamById.get(id);
              return (
                <option key={id} value={id}>
                  {team?.name ?? id}
                </option>
              );
            })}
          </select>
        )}
        {(filterMode === "top5" || filterMode === "top10") && (
          <select
            className="timeline-team-select"
            value={extraTeamId}
            onChange={(e) => setExtraTeamId(e.target.value)}
          >
            <option value="">+ Add a team…</option>
            {latestProbs
              .filter(([id]) => !visibleTeamIds.includes(id))
              .map(([id]) => {
                const team = teamById.get(id);
                return (
                  <option key={id} value={id}>
                    {team?.name ?? id}
                  </option>
                );
              })}
          </select>
        )}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 20, left: -10 }}>
          <CartesianGrid stroke="#26312e" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#6f7c77" }}
            tickLine={false}
            axisLine={false}
            angle={-18}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6f7c77" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#101b17", border: "1px solid #2a3933", borderRadius: 12, fontSize: 12 }}
            formatter={(value, name) => {
              const team = teamById.get(String(name));
              return [`${value}%`, team?.name ?? String(name)];
            }}
          />
          <Legend
            formatter={(value) => {
              const team = teamById.get(String(value));
              return team?.name ?? String(value);
            }}
            wrapperStyle={{ fontSize: 11, color: "#8b9993" }}
          />
          {visibleTeamIds.map((id, i) => (
            <Line
              key={id}
              dataKey={id}
              stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
