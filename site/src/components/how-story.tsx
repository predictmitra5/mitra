"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BadgeCheck, Check, Clock3, Lock, MousePointer2, Pause, Play, Search } from "lucide-react";
import { WALKTHROUGH } from "@/content/examples";
import { Thumb, initials } from "./thumb";

/*
 * How it works, after XO Market's "Create a Conviction" card: four steps
 * beside a card that plays them through on its own (a founder's video, the
 * market, a side picked, how it settles), with dashes counting the steps. The
 * step in play is marked in the list; a step can be picked to jump there. It
 * plays only while on screen, stops with its pause button, and stays on the
 * picked step for people who ask their device to reduce motion. The card is a
 * picture: screen readers get the list. On narrow screens the card comes
 * before the list, and the list opens only the step in play.
 */

const PHASES = [
  { key: "watch", title: "Watch the founder", body: "Short videos from early-stage founders: what they're building, who it's for and what they plan to do next.", ms: 5200 },
  { key: "read", title: "Read the market", body: "Each milestone becomes a Yes/No question with a date, and rules for what counts as Yes and what counts as No.", ms: 4200 },
  { key: "pick", title: "Pick a side", body: "Think they'll make it? Yes. Not convinced? No. Then follow the founder's updates as the date gets closer.", ms: 3800 },
  { key: "settle", title: "Settled from the source", body: "When the market closes, Mitra checks the source it named on day one and settles it.", ms: 5000 },
] as const;

const WORDS = WALKTHROUGH.caption.split(" ");

export function HowStory({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const current = PHASES[phase];
  const running = inView && !paused;
  const { example } = WALKTHROUGH;
  const style = { "--ms": `${current.ms}ms` } as CSSProperties;
  const advance = () => setPhase((value) => (value + 1) % PHASES.length);

  return (
    <div className="story how-story" data-running={running} style={style}>
      <div className="story-copy">
        {children}
      </div>

      <ol className="steps" data-reveal>
        {PHASES.map((item, index) => (
          <li key={item.key} className="step" data-active={index === phase}>
            <button type="button" onClick={() => setPhase(index)} aria-current={index === phase ? "step" : undefined}>
              <span className="step-num label">Step {index + 1}</span>
              <span className="step-text">
                <span className="step-title">{item.title}</span>
                <span className="step-more"><span className="step-body">{item.body}</span></span>
              </span>
              {index === phase && <i className="step-progress" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>

      <div className="story-art" data-reveal>
      <div ref={card} className="demo" data-phase={current.key}>
        <div className="demo-dashes" aria-hidden="true">
          {PHASES.map((item, index) => (
            <i key={item.key} data-on={index === phase} data-done={index < phase}>
              <b onAnimationEnd={index === phase ? advance : undefined} />
            </i>
          ))}
        </div>

        <div className="demo-stage" aria-hidden="true">
          <div className="demo-layer demo-watch" data-active={phase === 0}>
            <div className="demo-player">
              <Thumb example={example} bar={false} />
              <p className="demo-caption">
                {WORDS.map((word, index) => (
                  <span key={`${word}-${index}`} style={{ "--i": index } as CSSProperties}>{word} </span>
                ))}
              </p>
              <span className="demo-progress"><b /></span>
            </div>
            <div className="demo-founder">
              <span className="demo-avatar" style={{ "--face-hue": example.founder.hue } as CSSProperties}>{initials(example.founder.name)}</span>
              <span className="demo-founder-text">
                <strong>{WALKTHROUGH.videoTitle}</strong>
                <span>{example.founder.name} · {example.startup.name}</span>
              </span>
              <span className="demo-tag">Demo</span>
            </div>
            <p className="demo-description">{WALKTHROUGH.videoDescription}</p>
            <div className="demo-next">
              <span className="label">Its market</span>
              <span className="demo-next-question">{example.question}</span>
            </div>
          </div>

          <div className="demo-layer demo-market" data-active={phase === 1 || phase === 2} data-picked={phase === 2}>
            <p className="mcard-meta">
              <span className="label">{example.startup.industry} · {example.startup.name}</span>
              <span className="demo-tag">Demo</span>
            </p>
            <p className="demo-question">{example.question}</p>
            <dl className="demo-rules">
              <div style={{ "--i": 0 } as CSSProperties}><dt><i className="dot dot-yes" />Yes if</dt><dd>{WALKTHROUGH.yes}</dd></div>
              <div style={{ "--i": 1 } as CSSProperties}><dt><i className="dot dot-no" />No if</dt><dd>{WALKTHROUGH.no}</dd></div>
              <div style={{ "--i": 2 } as CSSProperties}><dt>Closes</dt><dd>{example.closes}</dd></div>
            </dl>
            <div className="demo-sides">
              <span className="demo-side demo-yes">
                Yes
                <span className="demo-cursor"><MousePointer2 strokeWidth={1.6} /></span>
              </span>
              <span className="demo-side demo-no">No</span>
            </div>
            <p className="demo-toast"><Check strokeWidth={2.4} />You picked Yes</p>
          </div>

          <div className="demo-layer demo-settle" data-active={phase === 3}>
            <p className="label demo-settle-label">When it closes</p>
            <ol className="demo-timeline">
              <li style={{ "--i": 0 } as CSSProperties}>
                <span className="demo-icon"><Clock3 strokeWidth={1.9} /></span>
                <span><strong>The market closes</strong><span>{WALKTHROUGH.closes}</span></span>
              </li>
              <li style={{ "--i": 1 } as CSSProperties}>
                <span className="demo-icon"><Search strokeWidth={1.9} /></span>
                <span><strong>Mitra checks the source</strong><span>{WALKTHROUGH.source}, named before the market opened</span></span>
              </li>
              <li style={{ "--i": 2 } as CSSProperties}>
                <span className="demo-icon demo-icon-done"><BadgeCheck strokeWidth={1.9} /></span>
                <span><strong>It&rsquo;s settled</strong><span>Yes or No, by the rules written on day one</span></span>
              </li>
            </ol>
            <p className="demo-lock"><Lock strokeWidth={2} />Rules locked since the market opened</p>
          </div>
        </div>

        <button
          type="button"
          className="demo-pause"
          aria-pressed={paused}
          aria-label={paused ? "Play the walkthrough" : "Pause the walkthrough"}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play aria-hidden="true" strokeWidth={2} /> : <Pause aria-hidden="true" strokeWidth={2} />}
        </button>
      </div>
      </div>
    </div>
  );
}
