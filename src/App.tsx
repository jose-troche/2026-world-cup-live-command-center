import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Brackets,
  ChevronDown,
  CircleDot,
  Command,
  GitCompareArrows,
  Menu,
  RefreshCw,
  Wifi,
  X,
} from "lucide-react";
import { BracketLab } from "./components/BracketLab";
import { GroupForecast } from "./components/GroupForecast";
import { LiveDashboard } from "./components/LiveDashboard";
import { TeamCompare } from "./components/TeamCompare";
import { useTournamentData } from "./hooks/useTournamentData";
import type { Match } from "./types";

type View = "live" | "groups" | "bracket" | "compare";

const navigation: Array<{ id: View; label: string; icon: typeof Command }> = [
  { id: "live", label: "Command center", icon: Command },
  { id: "groups", label: "Group forecast", icon: BarChart3 },
  { id: "bracket", label: "Bracket lab", icon: Brackets },
  { id: "compare", label: "Team explorer", icon: GitCompareArrows },
];

function getFeaturedMatch(matches: Match[]) {
  const live = matches.find((match) => match.status === "live");
  if (live) return live;

  const today = new Date();
  const dateKey = `${String(today.getUTCMonth() + 1).padStart(2, "0")}/${String(today.getUTCDate()).padStart(2, "0")}/${today.getUTCFullYear()}`;
  const todayMatch = matches.find((match) => match.localDate.startsWith(dateKey) && match.status !== "finished");
  if (todayMatch) return todayMatch;

  return (
    matches.find((match) => match.status === "scheduled") ??
    [...matches].reverse().find((match) => match.status === "finished") ??
    matches[0]
  );
}

function App() {
  const { data, loading, refreshing, refresh } = useTournamentData();
  const [view, setView] = useState<View>("live");
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const featuredMatch = useMemo(() => getFeaturedMatch(data.matches), [data.matches]);
  const selectedMatch =
    data.matches.find((match) => match.id === selectedMatchId) ?? featuredMatch;

  useEffect(() => {
    if (!selectedMatchId && featuredMatch) setSelectedMatchId(featuredMatch.id);
  }, [featuredMatch, selectedMatchId]);

  const updated = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(data.updatedAt));

  function navigate(nextView: View) {
    setView(nextView);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button className="brand" onClick={() => navigate("live")}>
          <span className="brand-mark"><CircleDot size={24} /></span>
          <span><strong>TOUCHLINE</strong><b>26</b></span>
        </button>

        <nav className={menuOpen ? "main-nav open" : "main-nav"}>
          {navigation.map((item) => (
            <button
              className={view === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
              key={item.id}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="data-status">
          <span className={data.source === "live" ? "live-source" : "fallback-source"}>
            <i />
            {data.source === "live" ? "Live feed" : "Snapshot"}
          </span>
          <button onClick={refresh} disabled={refreshing} aria-label="Refresh data">
            <RefreshCw size={15} className={refreshing ? "spinning" : ""} />
          </button>
        </div>
      </header>

      <main>
        <section className="page-masthead">
          <div>
            <span className="tournament-label">FIFA WORLD CUP 2026 · UNITED STATES / CANADA / MEXICO</span>
            <h1>
              {view === "live" && <>The match is speaking.<br /><em>Read every signal.</em></>}
              {view === "groups" && <>One table. Thousands<br /><em>of possible endings.</em></>}
              {view === "bracket" && <>Every champion needs<br /><em>a path through chaos.</em></>}
              {view === "compare" && <>Two teams enter.<br /><em>The data takes sides.</em></>}
            </h1>
          </div>
          <div className="masthead-meta">
            <div><Wifi size={15} /><span>Data updated</span><strong>{updated}</strong></div>
            <button onClick={() => setView("live")}>
              Tournament overview <ChevronDown size={14} />
            </button>
          </div>
        </section>

        {data.warning && <div className="data-warning">{data.warning}</div>}

        {loading && data.source === "fallback" && (
          <div className="loading-line"><span /></div>
        )}

        {view === "live" && selectedMatch && (
          <LiveDashboard
            match={selectedMatch}
            matches={data.matches}
            teams={data.teams}
            stadiums={data.stadiums}
            onSelectMatch={(match) => setSelectedMatchId(match.id)}
          />
        )}
        {view === "groups" && (
          <GroupForecast groups={data.groups} matches={data.matches} teams={data.teams} />
        )}
        {view === "bracket" && <BracketLab teams={data.teams} />}
        {view === "compare" && <TeamCompare teams={data.teams} />}
      </main>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark"><CircleDot size={19} /></span>
          <strong>TOUCHLINE 26</strong>
        </div>
        <p>Independent analytics experience. Not affiliated with FIFA.</p>
        <span>Live scores: worldcup26.ir · Models run locally</span>
      </footer>
    </div>
  );
}

export default App;
