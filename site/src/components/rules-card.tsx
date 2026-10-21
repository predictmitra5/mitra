"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Lock } from "lucide-react";
import { RULES_EXAMPLE } from "@/content/examples";

/*
 * A market's written rules, after XO Market's white "Open to challenge" card
 * on black: when it comes into view its lines arrive one by one, the track
 * shows the market as open, and the locked-wording note pops in. It plays
 * once; for people who ask their device to reduce motion it is simply there.
 */

const STAGES = ["Written", "Open", "Closes", "Settled"];

export function RulesCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setOn(true);
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows = [
    { term: "Yes if", tone: "yes", text: RULES_EXAMPLE.yes },
    { term: "No if", tone: "no", text: RULES_EXAMPLE.no },
    { term: "Source", tone: null, text: RULES_EXAMPLE.source },
    { term: "Closes", tone: null, text: RULES_EXAMPLE.closes },
  ];

  return (
    <div ref={ref} className="rules-card" data-on={on}>
      <p className="mcard-meta">
        <span className="label">{RULES_EXAMPLE.label}</span>
        <span className="demo-tag">Demo</span>
      </p>
      <p className="rules-question">{RULES_EXAMPLE.question}</p>
      <dl className="rules-list">
        {rows.map((row, index) => (
          <div key={row.term} style={{ "--i": index } as CSSProperties}>
            <dt>{row.tone && <i className={`dot dot-${row.tone}`} aria-hidden="true" />}{row.term}</dt>
            <dd>{row.text}</dd>
          </div>
        ))}
      </dl>
      <div className="rules-track">
        <span className="rules-bar" aria-hidden="true"><b /></span>
        <ol aria-label="Where this market is">
          {STAGES.map((stage, index) => (
            <li key={stage} data-state={index === 0 ? "done" : index === 1 ? "now" : undefined}
                aria-current={index === 1 ? "step" : undefined}>
              <i aria-hidden="true" />
              {stage}
            </li>
          ))}
        </ol>
      </div>
      <p className="rules-lock"><Lock aria-hidden="true" strokeWidth={2} />Wording locked when the market opened</p>
    </div>
  );
}
