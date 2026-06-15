import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Brackets,
  CircleDot,
  GitCompareArrows,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { shouldHideIntro } from "../lib/introPreference";

type IntroExperienceProps = {
  onClose: (hideNextTime: boolean) => void;
};

const features = [
  {
    icon: Radio,
    number: "01",
    title: "Understand the match",
    description: "Follow live scores and match state alongside projected outcome probabilities and an estimated xG timeline.",
  },
  {
    icon: BarChart3,
    number: "02",
    title: "Project the group stage",
    description: "See how every remaining fixture shapes each team’s probability of reaching the Round of 32.",
  },
  {
    icon: Brackets,
    number: "03",
    title: "Explore the knockout path",
    description: "Choose each winner or run a model-based simulation to map a contender’s route to the title.",
  },
  {
    icon: GitCompareArrows,
    number: "04",
    title: "Compare the contenders",
    description: "Evaluate modeled team profiles, relative strengths, form index, and projected head-to-head advantage.",
  },
];

export function IntroExperience({ onClose }: IntroExperienceProps) {
  const [hideNextTime, setHideNextTime] = useState(() =>
    shouldHideIntro(typeof window === "undefined" ? undefined : window.localStorage),
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose(hideNextTime);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hideNextTime, onClose]);

  return (
    <div className="intro-backdrop" role="presentation">
      <section
        className="intro-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        aria-describedby="intro-description"
      >
        <button
          className="intro-close"
          onClick={() => onClose(hideNextTime)}
          aria-label="Close overview"
        >
          <X size={18} />
        </button>

        <div className="intro-hero">
          <div className="intro-brand">
            <span className="brand-mark"><CircleDot size={22} /></span>
            <span><strong>TOUCHLINE</strong><b>26</b></span>
          </div>
          <span className="intro-live"><i /> Live tournament analytics</span>
          <h2 id="intro-title">See the tournament<br /><em>beyond the score.</em></h2>
          <p id="intro-description">
            Touchline 26 brings live match data and transparent projections together
            in one focused view of the 2026 World Cup.
          </p>
          <div className="intro-model-note">
            <Sparkles size={15} />
            Scores and standings come from the live feed. xG and probabilities are model projections.
          </div>
        </div>

        <div className="intro-features">
          {features.map((feature) => (
            <article key={feature.number}>
              <div>
                <span>{feature.number}</span>
                <feature.icon size={18} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>

        <div className="intro-actions">
          <label>
            <input
              type="checkbox"
              checked={hideNextTime}
              onChange={(event) => setHideNextTime(event.target.checked)}
            />
            <span aria-hidden="true" />
            Skip this overview next time
          </label>
          <button className="intro-enter" onClick={() => onClose(hideNextTime)}>
            Open match center
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
