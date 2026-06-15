import { useMemo, useState } from "react";
import { ArrowLeftRight, Gauge, ShieldCheck, Swords, Zap } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getTeamMetrics } from "../lib/analytics";
import type { Team } from "../types";
import { Flag } from "./Flag";

type Props = {
  teams: Team[];
};

export function TeamCompare({ teams }: Props) {
  const sorted = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const [leftId, setLeftId] = useState(sorted.find((team) => team.name === "Brazil")?.id ?? sorted[0]?.id);
  const [rightId, setRightId] = useState(sorted.find((team) => team.name === "France")?.id ?? sorted[1]?.id);
  const left = sorted.find((team) => team.id === leftId) ?? sorted[0];
  const right = sorted.find((team) => team.id === rightId) ?? sorted[1];

  if (!left || !right) return <div className="empty-state panel">Team data is loading.</div>;

  const leftMetrics = getTeamMetrics(left);
  const rightMetrics = getTeamMetrics(right);
  const radarData = [
    { metric: "Attack", left: leftMetrics.attack, right: rightMetrics.attack },
    { metric: "Control", left: leftMetrics.control, right: rightMetrics.control },
    { metric: "Defense", left: leftMetrics.defense, right: rightMetrics.defense },
    { metric: "Set pieces", left: leftMetrics.setPieces, right: rightMetrics.setPieces },
    { metric: "Form", left: leftMetrics.form, right: rightMetrics.form },
    { metric: "Transition", left: leftMetrics.transition, right: rightMetrics.transition },
  ];
  const leftChance = Math.round(100 / (1 + Math.exp(-(leftMetrics.rating - rightMetrics.rating) / 7)));

  function swap() {
    setLeftId(right.id);
    setRightId(left.id);
  }

  return (
    <div className="lab-stack">
      <section className="lab-intro">
        <div>
          <span className="eyebrow">Matchup intelligence</span>
          <h2>Team comparison explorer</h2>
          <p>Compare tactical profiles, core strengths, and a neutral-site head-to-head projection.</p>
        </div>
      </section>

      <section className="compare-selector panel">
        <label>
          <span>Team one</span>
          <div><Flag team={left} size="sm" /><select value={left.id} onChange={(event) => setLeftId(event.target.value)}>
            {sorted.filter((team) => team.id !== right.id).map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
          </select></div>
        </label>
        <button className="swap-button" onClick={swap} aria-label="Swap teams"><ArrowLeftRight size={18} /></button>
        <label>
          <span>Team two</span>
          <div><Flag team={right} size="sm" /><select value={right.id} onChange={(event) => setRightId(event.target.value)}>
            {sorted.filter((team) => team.id !== left.id).map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
          </select></div>
        </label>
      </section>

      <section className="compare-grid">
        <article className="panel radar-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Style fingerprint</span>
              <h3>Tactical radar</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={390}>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="#33403b" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#9aa8a2", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#101b17", border: "1px solid #2a3933", borderRadius: 12 }} />
              <Radar name={left.name} dataKey="left" stroke="#d9ff43" fill="#d9ff43" fillOpacity={0.22} strokeWidth={2.5} />
              <Radar name={right.name} dataKey="right" stroke="#ff7043" fill="#ff7043" fillOpacity={0.16} strokeWidth={2.5} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="compare-legend">
            <span><i className="lime" />{left.name}</span>
            <span><i className="coral" />{right.name}</span>
          </div>
        </article>

        <article className="panel matchup-panel">
          <div className="versus-header">
            <div><Flag team={left} size="lg" /><strong>{left.code}</strong><span>{leftMetrics.rating}</span></div>
            <b>VS</b>
            <div><Flag team={right} size="lg" /><strong>{right.code}</strong><span>{rightMetrics.rating}</span></div>
          </div>
          <div className="h2h-probability">
            <span style={{ width: `${leftChance}%` }} />
          </div>
          <div className="h2h-labels">
            <strong>{leftChance}%</strong><span>Projected knockout edge</span><strong>{100 - leftChance}%</strong>
          </div>

          <div className="metric-duels">
            {[
              { label: "Attacking threat", icon: Swords, left: leftMetrics.attack, right: rightMetrics.attack },
              { label: "Defensive security", icon: ShieldCheck, left: leftMetrics.defense, right: rightMetrics.defense },
              { label: "Transition speed", icon: Zap, left: leftMetrics.transition, right: rightMetrics.transition },
              { label: "Current form", icon: Gauge, left: leftMetrics.form, right: rightMetrics.form },
            ].map((metric) => (
              <div className="metric-duel" key={metric.label}>
                <strong>{metric.left}</strong>
                <span><metric.icon size={15} />{metric.label}</span>
                <strong>{metric.right}</strong>
                <i className="left" style={{ width: `${metric.left / 2}%` }} />
                <i className="right" style={{ width: `${metric.right / 2}%` }} />
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
