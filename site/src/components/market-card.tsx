import type { Example } from "@/content/examples";
import { Thumb } from "./thumb";

/*
 * An example market card in the app's shape (DESIGN.md sections 16 and 17):
 * the founder video's thumbnail, industry and startup in small capitals with
 * the Demo label, the question, the close date, and Yes and No. Per the
 * owner's 2026-10-20 answer there is no price, chance, volume or trader count.
 */

export function MarketCard({ example, href }: { example: Example; href: string }) {
  return (
    <li className="mcard" data-card>
      <a className="mcard-link" href={href}>
        <div className="mcard-media">
          <Thumb example={example} />
        </div>
        <div className="mcard-body">
          <p className="mcard-meta">
            <span className="label">{example.startup.industry} · {example.startup.name}</span>
            <span className="demo-tag">Demo</span>
          </p>
          <h3 className="mcard-question">{example.question}</h3>
          <div className="mcard-foot">
            <span className="mcard-close">Closes {example.closes}</span>
            <span className="mcard-sides" aria-hidden="true">
              <span className="side side-yes">Yes</span>
              <span className="side side-no">No</span>
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
