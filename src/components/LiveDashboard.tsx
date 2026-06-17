import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock3, MapPin, Radio, ScanLine } from "lucide-react";
import { buildXgRace, expectedGoals, winProbability } from "../lib/analytics";
import { getMatchPath } from "../lib/viral";
import type { Match, Stadium, Team } from "../types";
import { FanPoll } from "./FanPoll";
import { Flag } from "./Flag";
import { ShareButtons } from "./ShareButtons";

type MatchListMode = "next" | "former";

type Props = {
  match: Match;
  matches: Match[];
  teams: Team[];
  stadiums: Stadium[];
  onSelectMatch: (match: Match) => void;
};

function statusLabel(match: Match) {
  if (match.status === "live") return `${match.minute}' LIVE`;
  if (match.status === "finished") return "FINAL";
  return formatMatchTime(match);
}

function parseLocalDate(value: string) {
  const [datePart, timePart = "00:00"] = value.split(" ");
  const [month, day, year] = datePart.split("/");
  const [hour, minute] = timePart.split(":");
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function getMatchDate(match: Match) {
  return match.utcDate ? new Date(match.utcDate) : parseLocalDate(match.localDate);
}

function formatMatchTime(match: Match) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(getMatchDate(match));
}

function formatMatchDateTime(match: Match) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(getMatchDate(match));
}

function formatVenue(stadium?: Stadium) {
  if (!stadium) return "Venue to be confirmed";
  const city = stadium.city.split(",")[0].trim();
  const location = [city, stadium.countryCode].filter(Boolean).join(", ");
  return location ? `${stadium.name} · ${location}` : stadium.name;
}

export function LiveDashboard({ match, matches, teams, stadiums, onSelectMatch }: Props) {
  const [matchListMode, setMatchListMode] = useState<MatchListMode>("next");
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const homeTeam = teamById.get(match.homeId);
  const awayTeam = teamById.get(match.awayId);
  const stadium = stadiums.find((item) => item.id === match.stadiumId);
  const probability = winProbability(match);
  const xgRace = buildXgRace(match);
  const baseline = expectedGoals(match.homeName, match.awayName);
  const timeLeft = Math.max(0, (90 - match.minute) / 90);
  const projectedXg = {
    home: match.homeScore + baseline.home * timeLeft,
    away: match.awayScore + baseline.away * timeLeft,
  };
  const probabilityData = [
    { name: match.homeName, value: probability.home, color: "#d9ff43" },
    { name: "Draw", value: probability.draw, color: "#66716d" },
    { name: match.awayName, value: probability.away, color: "#ff7043" },
  ];

  const relevantMatches = matches
    .filter((item) => item.type === "group" && (matchListMode === "former" ? item.status === "finished" : item.status !== "finished"))
    .sort((a, b) => {
      if (matchListMode === "former") return getMatchDate(b).getTime() - getMatchDate(a).getTime();
      const rank = { live: 0, scheduled: 1, finished: 2 };
      return rank[a.status] - rank[b.status] || getMatchDate(a).getTime() - getMatchDate(b).getTime();
    })
    .slice(0, 8);

  return (
    <div className="dashboard-stack">
      <section className="match-ticker panel">
        <div className="ticker-label">
          <Radio size={15} />
          Match schedule
        </div>
        <div className="ticker-mode" role="group" aria-label="Match schedule view">
          <button
            className={matchListMode === "next" ? "active" : ""}
            onClick={() => setMatchListMode("next")}
          >
            Now / next
          </button>
          <button
            className={matchListMode === "former" ? "active" : ""}
            onClick={() => setMatchListMode("former")}
          >
            Former scores
          </button>
        </div>
        <div className="ticker-scroll">
          {relevantMatches.map((item) => {
            const tickerHome = teamById.get(item.homeId);
            const tickerAway = teamById.get(item.awayId);
            return (
              <button
                className={`ticker-match ${item.id === match.id ? "active" : ""}`}
                key={item.id}
                onClick={() => onSelectMatch(item)}
              >
                <span className={`mini-status ${item.status}`}>{statusLabel(item)}</span>
                <span className="ticker-team">
                  <Flag team={tickerHome} size="sm" />
                  {tickerHome?.code ?? item.homeName.slice(0, 3).toUpperCase()}
                </span>
                <strong>{item.homeScore}</strong>
                <span className="ticker-divider">:</span>
                <strong>{item.awayScore}</strong>
                <span className="ticker-team">
                  <Flag team={tickerAway} size="sm" />
                  {tickerAway?.code ?? item.awayName.slice(0, 3).toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <article className="panel match-stage">
          <div className="panel-kicker">
            <span>Group {match.group} · Matchday {match.matchday || 1}</span>
            <span className={`status-chip ${match.status}`}>
              {match.status === "live" && <i />}
              {statusLabel(match)}
            </span>
          </div>

          <div className="scoreboard">
            <div className="score-team">
              <Flag team={homeTeam} size="lg" />
              <div>
                <span className="team-code">{homeTeam?.code ?? "HOME"}</span>
                <h2>{match.homeName}</h2>
              </div>
            </div>
            <div className="score">
              <strong>{match.homeScore}</strong>
              <span>–</span>
              <strong>{match.awayScore}</strong>
            </div>
            <div className="score-team away">
              <div>
                <span className="team-code">{awayTeam?.code ?? "AWAY"}</span>
                <h2>{match.awayName}</h2>
              </div>
              <Flag team={awayTeam} size="lg" />
            </div>
          </div>

          <div className="match-meta">
            <span><Clock3 size={14} /> {formatMatchDateTime(match)}</span>
            <span><MapPin size={14} /> {formatVenue(stadium)}</span>
          </div>

          <div className="signal-strip">
            <div>
              <span>Projected xG</span>
              <strong>{projectedXg.home.toFixed(2)} <i>–</i> {projectedXg.away.toFixed(2)}</strong>
            </div>
            <div>
              <span>Match phase</span>
              <strong>{match.status === "live" ? "In play" : match.status === "finished" ? "Final" : "Upcoming"}</strong>
            </div>
          </div>
      </article>

      <FanPoll
        match={match}
        modelProbability={probability}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
      />

      <article className="panel win-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Outcome model</span>
              <h3>Match result probability</h3>
            </div>
            {(() => {
              const title = `${match.homeName} vs ${match.awayName} — ${Math.round(Math.max(probability.home, probability.away) * 100)}% projected winner`;
              const url = `${window.location.origin}${getMatchPath(match)}`;
              return (
                <div className="insight-share-row">
                  <ShareButtons title={title} url={url} />
                </div>
              );
            })()}
          </div>
          <div className="probability-donut">
            <ResponsiveContainer width="100%" height={208}>
              <PieChart>
                <Pie
                  data={probabilityData}
                  dataKey="value"
                  innerRadius={67}
                  outerRadius={88}
                  startAngle={210}
                  endAngle={-30}
                  stroke="none"
                  paddingAngle={2}
                >
                  {probabilityData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{Math.round(Math.max(probability.home, probability.away, probability.draw) * 100)}%</strong>
              <span>most likely outcome</span>
            </div>
          </div>
          <div className="probability-legend">
            {probabilityData.map((item) => (
              <div key={item.name}>
                <span><i style={{ background: item.color }} />{item.name}</span>
                <strong>{Math.round(item.value * 100)}%</strong>
              </div>
            ))}
          </div>
      </article>

      <section className="analytics-grid">
        <article className="panel xg-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Chance quality model</span>
              <h3>xG timeline</h3>
            </div>
            <div className="chart-legend">
              <span><i className="lime" />{homeTeam?.code ?? "HOME"}</span>
              <span><i className="coral" />{awayTeam?.code ?? "AWAY"}</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={xgRace} margin={{ top: 14, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="homeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d9ff43" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#d9ff43" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="awayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff7043" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ff7043" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#26312e" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="minute" stroke="#6f7c77" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}'`} />
                <YAxis stroke="#6f7c77" tickLine={false} axisLine={false} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#101b17", border: "1px solid #2a3933", borderRadius: 12 }}
                  labelFormatter={(value) => `Minute ${value}`}
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      projHome: `Proj. ${homeTeam?.code ?? "HOME"}`,
                      projAway: `Proj. ${awayTeam?.code ?? "AWAY"}`,
                      actualHome: `Goals ${homeTeam?.code ?? "HOME"}`,
                      actualAway: `Goals ${awayTeam?.code ?? "AWAY"}`,
                    };
                    const v = typeof value === "number" ? value.toFixed(2) : String(value ?? "");
                    const k = String(name ?? "");
                    return [v, labels[k] ?? k];
                  }}
                />
                {match.status === "live" && <ReferenceLine x={match.minute} stroke="#f5f7f6" strokeDasharray="4 4" />}
                <Area type="monotone" dataKey="projHome" stroke="#d9ff43" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.6} fill="url(#homeGradient)" />
                <Area type="monotone" dataKey="projAway" stroke="#ff7043" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.6} fill="url(#awayGradient)" />
                <Area type="stepAfter" dataKey="actualHome" stroke="#d9ff43" strokeWidth={2.5} fill="none" />
                <Area type="stepAfter" dataKey="actualAway" stroke="#ff7043" strokeWidth={2.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="model-note">
            <ScanLine size={14} />
            Dashed lines: model projection. Solid steps: actual goals, spaced evenly across played time.
          </p>
        </article>

      </section>
    </div>
  );
}
