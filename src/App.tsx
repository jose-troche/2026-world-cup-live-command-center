import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Volleyball,
  Brackets,
  ChevronDown,
  CircleDot,
  Command,
  GitCompareArrows,
  Menu,
  RefreshCw,
  Sparkles,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { BracketLab } from "./components/BracketLab";
import { GroupForecast } from "./components/GroupForecast";
import { InsightsPage } from "./components/InsightsPage";
import { IntroExperience } from "./components/IntroExperience";
import { LiveDashboard } from "./components/LiveDashboard";
import { GoalImpactPage } from "./components/GoalImpactPage";
import { TeamCompare } from "./components/TeamCompare";
import { fallbackData } from "./data/fallback";
import { useTournamentData } from "./hooks/useTournamentData";
import { trackPageview } from "./lib/beacon";
import { saveIntroPreference, shouldHideIntro } from "./lib/introPreference";
import { buildViralContent, getContentPath, getMatchPath, getTeamPath } from "./lib/viral";
import type { ContentStory } from "./lib/viral";
import type { Match, Team } from "./types";

type View = "live" | "groups" | "bracket" | "compare" | "insights" | "goal-impact";

const navigation: Array<{ id: View; label: string; icon: typeof Command }> = [
  { id: "live", label: "Match center", icon: Command },
  { id: "groups", label: "Advancement", icon: BarChart3 },
  { id: "compare", label: "Team comparison", icon: GitCompareArrows },
  { id: "bracket", label: "Bracket simulator", icon: Brackets },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "goal-impact", label: "Goal Impact", icon: Volleyball },
];

function getPathname() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function getViewFromPath(pathname: string): View {
  if (pathname.startsWith("/groups")) return "groups";
  if (pathname.startsWith("/bracket")) return "bracket";
  if (pathname.startsWith("/teams")) return "compare";
  if (pathname.startsWith("/goal-impact")) return "goal-impact";
  if (pathname.startsWith("/insights") || pathname.startsWith("/content")) return "insights";
  return "live";
}

function getViewPath(view: View) {
  if (view === "groups") return "/groups";
  if (view === "bracket") return "/bracket";
  if (view === "compare") return "/teams";
  if (view === "insights") return "/insights";
  if (view === "goal-impact") return "/goal-impact";
  return "/";
}

function getGroupFromPath(pathname: string) {
  const match = /^\/groups\/group-([a-z0-9-]+)$/i.exec(pathname);
  return match ? match[1].toUpperCase() : undefined;
}

function findRouteMatch(pathname: string, matches: Match[]) {
  return matches.find((match) => getMatchPath(match) === pathname);
}

function findRouteTeam(pathname: string, teams: Team[]) {
  return teams.find((team) => getTeamPath(team) === pathname);
}

function findRouteStory(pathname: string, stories: ContentStory[]) {
  return stories.find((story) => getContentPath(story.slug) === pathname);
}

function setMeta(name: string, content: string, property = false) {
  if (typeof document === "undefined") return;
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setJsonLd(data: Record<string, unknown>) {
  if (typeof document === "undefined") return;
  let element = document.head.querySelector<HTMLScriptElement>("#touchline-json-ld");
  if (!element) {
    element = document.createElement("script");
    element.id = "touchline-json-ld";
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

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
  const { data, loading, refreshing, refresh, latestGoal, goalHistory } = useTournamentData();
  const [toastDismissedId, setToastDismissedId] = useState<string | null>(null);
  const showToast = latestGoal !== null && toastDismissedId !== latestGoal.detectedAt;
  const [pathname, setPathname] = useState(getPathname);
  const [view, setView] = useState<View>(() => getViewFromPath(getPathname()));
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(
    () => !shouldHideIntro(typeof window === "undefined" ? undefined : window.localStorage),
  );
  const featuredMatch = useMemo(() => getFeaturedMatch(data.matches), [data.matches]);
  const viralContent = useMemo(
    () => buildViralContent(data, typeof window === "undefined" ? "" : window.location.origin),
    [data],
  );
  const fallbackViralContent = useMemo(
    () => buildViralContent(fallbackData, typeof window === "undefined" ? "" : window.location.origin),
    [],
  );
  const routeMatch = useMemo(
    () => findRouteMatch(pathname, data.matches) ?? findRouteMatch(pathname, fallbackData.matches),
    [data.matches, pathname],
  );
  const routeTeam = useMemo(() => findRouteTeam(pathname, data.teams), [data.teams, pathname]);
  const routeStory = useMemo(
    () =>
      findRouteStory(pathname, viralContent.contentStories) ??
      findRouteStory(pathname, fallbackViralContent.contentStories),
    [fallbackViralContent.contentStories, pathname, viralContent.contentStories],
  );
  const routeGroup = getGroupFromPath(pathname);
  const selectedMatch =
    routeMatch ?? data.matches.find((match) => match.id === selectedMatchId) ?? featuredMatch;

  useEffect(() => {
    if (!selectedMatchId && featuredMatch) setSelectedMatchId(featuredMatch.id);
  }, [featuredMatch, selectedMatchId]);

  useEffect(() => {
    function syncRoute() {
      const nextPath = getPathname();
      setPathname(nextPath);
      setView(getViewFromPath(nextPath));
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (routeMatch) setSelectedMatchId(routeMatch.id);
  }, [routeMatch]);

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
    const titlePrefix =
      routeMatch ? `${routeMatch.homeName} vs ${routeMatch.awayName} prediction` :
      routeStory ? routeStory.title :
      routeTeam ? `${routeTeam.name} World Cup probabilities` :
      routeGroup ? `World Cup Group ${routeGroup} probabilities` :
      view === "insights" ? "Stories and content hub" :
      view === "goal-impact" ? "Goal impact feed" :
      view === "groups" ? "Group advancement probabilities" :
      view === "bracket" ? "World Cup bracket simulator" :
      view === "compare" ? "Team comparison model" :
      "Live World Cup analytics";
    const description =
      routeMatch ? `Win probability, match context, and shareable analytics for ${routeMatch.homeName} vs ${routeMatch.awayName}.` :
      routeStory ? routeStory.summary :
      routeTeam ? `Live World Cup 2026 strength profile and probability context for ${routeTeam.name}.` :
      routeGroup ? `Live standings and qualification probabilities for World Cup 2026 Group ${routeGroup}.` :
      "Touchline 26 turns World Cup match data into probabilities, rankings, share cards, and tournament analytics.";

    document.title = `${titlePrefix} | Touchline 26`;
    setMeta("description", description);
    setMeta("og:title", document.title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", "website", true);
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const ogImage =
      routeMatch ? `${origin}/api/cards/match/${encodeURIComponent(routeMatch.id)}.svg` :
      routeStory ? routeStory.cardUrl :
      `${origin}/api/cards/power-rankings.svg`;
    setMeta("og:image", ogImage, true);
    setMeta("og:image:width", "1200", true);
    setMeta("og:image:height", "630", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:image", ogImage);
    setJsonLd({
      "@context": "https://schema.org",
      "@type": routeMatch ? "SportsEvent" : routeTeam ? "SportsTeam" : routeStory ? "Article" : "WebPage",
      name: titlePrefix,
      headline: routeStory?.title,
      description,
      sport: routeMatch ? "Soccer" : undefined,
      competitor: routeMatch ? [routeMatch.homeName, routeMatch.awayName] : undefined,
      url: typeof window === "undefined" ? undefined : window.location.href,
    });
  }, [pathname, routeGroup, routeMatch, routeStory, routeTeam, view]);

  const updated = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(data.updatedAt));

  function navigate(nextView: View) {
    setView(nextView);
    setMenuOpen(false);
    const nextPath = getViewPath(nextView);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
      setPathname(nextPath);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeIntro(hideNextTime: boolean) {
    saveIntroPreference(
      hideNextTime,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
    setIntroOpen(false);
  }

  return (
    <div className="app-shell">
      {introOpen && <IntroExperience onClose={closeIntro} />}
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
              {item.id === "goal-impact" && latestGoal && (
                <span className="goal-nav-badge">GOAL</span>
              )}
            </button>
          ))}
        </nav>

        <div className="data-status">
          <span className={data.source === "live" ? "live-source" : "fallback-source"}>
            <i />
            {data.source === "live" ? "Live data" : "Saved snapshot"}
          </span>
          <button onClick={refresh} disabled={refreshing} aria-label="Refresh tournament data">
            <RefreshCw size={15} className={refreshing ? "spinning" : ""} />
          </button>
        </div>
      </header>

      {showToast && latestGoal && (
        <div className="goal-toast">
          <Zap size={15} className="goal-toast-zap" />
          <span className="goal-toast-text">
            <strong>GOAL!</strong>{" "}
            {latestGoal.homeName} {latestGoal.scoreAfter.home}–{latestGoal.scoreAfter.away} {latestGoal.awayName}{" "}
            ({latestGoal.minute}')
          </span>
          <button
            className="goal-toast-cta"
            onClick={() => { navigate("goal-impact"); setToastDismissedId(latestGoal.detectedAt); }}
          >
            View analysis
          </button>
          <button
            className="goal-toast-dismiss"
            onClick={() => setToastDismissedId(latestGoal.detectedAt)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <main>
        <section className="page-masthead">
          <div>
            <span className="tournament-label">WORLD CUP 2026 · UNITED STATES · CANADA · MEXICO</span>
            <h1>
              {view === "live" && <>Every match,<br /><em>in sharper focus.</em></>}
              {view === "groups" && <>See the table<br /><em>before it settles.</em></>}
              {view === "bracket" && <>Trace every route<br /><em>to the title.</em></>}
              {view === "compare" && <>Measure how the<br /><em>contenders match up.</em></>}
              {view === "insights" && <>Stories and posts<br /><em>from live data.</em></>}
              {view === "goal-impact" && <>Every goal,<br /><em>ready to share.</em></>}
            </h1>
          </div>
          <div className="masthead-meta">
            <div><Wifi size={15} /><span>Last data refresh</span><strong>{updated}</strong></div>
            <button onClick={() => setView("live")}>
              Return to match center <ChevronDown size={14} />
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
          <GroupForecast
            groups={data.groups}
            matches={data.matches}
            teams={data.teams}
            selectedGroupName={routeGroup ?? featuredMatch?.group}
          />
        )}
        {view === "bracket" && <BracketLab teams={data.teams} />}
        {view === "compare" && (
          <TeamCompare
            teams={data.teams}
            initialTeamId={routeTeam?.id ?? featuredMatch?.homeId}
            initialRightTeamId={routeTeam ? undefined : featuredMatch?.awayId}
          />
        )}
        {view === "insights" && (
          <InsightsPage data={data} routeStory={routeStory} />
        )}
        {view === "goal-impact" && (
          <GoalImpactPage goalHistory={goalHistory} data={data} />
        )}
      </main>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark"><CircleDot size={19} /></span>
          <strong>TOUCHLINE 26</strong>
        </div>
        <p>
          Independent tournament analytics. Not affiliated with FIFA.
          <button className="intro-reopen" onClick={() => setIntroOpen(true)}>About Touchline 26</button>
        </p>
        <span>Match data: ESPN scoreboard · Projections calculated in your browser</span>
      </footer>
    </div>
  );
}

export default App;
