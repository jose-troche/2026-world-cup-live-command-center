import { useMemo } from "react";
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
import type { Match, Stadium, Team } from "../types";
import { Flag } from "./Flag";

type Props = {
  match: Match;
  matches: Match[];
  teams: Team[];
  stadiums: Stadium[];
  onSelectMatch: (match: Match) => void;
};

function statusLabel(match: Match) {
  if (match.status === "live") return `${match.minute}' LIVE`;
  if (match.status === "finished") return "FULL TIME";
  const [, time = ""] = match.localDate.split(" ");
  return time;
}

function formatDate(value: string) {
  const [datePart] = value.split(" ");
  const [month, day, year] = datePart.split("/");
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}

export function LiveDashboard({ match, matches, teams, stadiums, onSelectMatch }: Props) {
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const homeTeam = teamById.get(match.homeId);
  const awayTeam = teamById.get(match.awayId);
  const stadium = stadiums.find((item) => item.id === match.stadiumId);
  const probability = winProbability(match);
  const xgRace = buildXgRace(match);
  const xg = xgRace.at(-1) ?? { home: 0, away: 0 };
  const preMatchXg = expectedGoals(match.homeName, match.awayName);
  const probabilityData = [
    { name: match.homeName, value: probability.home, color: "#d9ff43" },
    { name: "Draw", value: probability.draw, color: "#66716d" },
    { name: match.awayName, value: probability.away, color: "#ff7043" },
  ];

  const relevantMatches = matches
    .filter((item) => item.type === "group")
    .sort((a, b) => {
      const rank = { live: 0, scheduled: 1, finished: 2 };
      return rank[a.status] - rank[b.status] || Number(a.id) - Number(b.id);
    })
    .slice(0, 8);

  return (
    <div className="dashboard-stack">
      <section className="match-ticker panel">
        <div className="ticker-label">
          <Radio size={15} />
          Matchwire
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

      <section className="hero-grid">
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
            <span><Clock3 size={14} /> {formatDate(match.localDate)}</span>
            <span><MapPin size={14} /> {stadium?.name ?? "World Cup venue"}</span>
          </div>

          <div className="signal-strip">
            <div>
              <span>Model xG</span>
              <strong>{xg.home.toFixed(2)} <i>–</i> {xg.away.toFixed(2)}</strong>
            </div>
            <div>
              <span>Pre-match xG</span>
              <strong>{preMatchXg.home.toFixed(2)} <i>–</i> {preMatchXg.away.toFixed(2)}</strong>
            </div>
            <div>
              <span>Game state</span>
              <strong>{match.status === "live" ? "Open" : match.status === "finished" ? "Settled" : "Pre-match"}</strong>
            </div>
          </div>
        </article>

        <article className="panel win-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Live model</span>
              <h3>Win probability</h3>
            </div>
            <Activity size={19} />
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
              <span>top outcome</span>
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
      </section>

      <section className="analytics-grid">
        <article className="panel xg-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Chance creation</span>
              <h3>Expected goals race</h3>
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
                    <stop offset="0%" stopColor="#d9ff43" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#d9ff43" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="awayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff7043" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#ff7043" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#26312e" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="minute" stroke="#6f7c77" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}'`} />
                <YAxis stroke="#6f7c77" tickLine={false} axisLine={false} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#101b17", border: "1px solid #2a3933", borderRadius: 12 }}
                  labelFormatter={(value) => `${value}' minute`}
                />
                {match.status === "live" && <ReferenceLine x={match.minute} stroke="#f5f7f6" strokeDasharray="4 4" />}
                <Area type="stepAfter" dataKey="home" stroke="#d9ff43" strokeWidth={2.5} fill="url(#homeGradient)" />
                <Area type="stepAfter" dataKey="away" stroke="#ff7043" strokeWidth={2.5} fill="url(#awayGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="model-note">
            <ScanLine size={14} />
            Model-estimated xG from team strength and game state. The public live feed does not supply shot locations.
          </p>
        </article>

        <article className="panel momentum-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Match pulse</span>
              <h3>Pressure map</h3>
            </div>
          </div>
          <div className="pitch-map">
            <div className="pitch-line center" />
            <div className="pitch-circle" />
            <div className="pitch-box left" />
            <div className="pitch-box right" />
            {Array.from({ length: 16 }, (_, index) => {
              const left = 7 + ((index * 23 + Number(match.id) * 7) % 87);
              const top = 11 + ((index * 31 + Number(match.id) * 3) % 76);
              const home = index % 3 !== 0;
              return (
                <span
                  className={`pressure-dot ${home ? "home" : "away"}`}
                  style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${index * 90}ms` }}
                  key={index}
                />
              );
            })}
            <div className="territory home" style={{ width: `${45 + probability.home * 20}%` }} />
          </div>
          <div className="pressure-stats">
            <div><strong>{Math.round(48 + probability.home * 20)}%</strong><span>territorial pressure</span></div>
            <div><strong>{Math.round(52 - probability.home * 20)}%</strong><span>territorial pressure</span></div>
          </div>
        </article>
      </section>
    </div>
  );
}
