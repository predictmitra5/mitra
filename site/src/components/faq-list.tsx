"use client";

import { useState } from "react";

/*
 * Questions and answers as on xo.market: one answer open at a time, the first
 * open to begin with, a square toggle whose bar turns as it opens. Closed
 * answers are inert, so they are skipped by the keyboard and screen readers.
 */

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq-list" data-reveal>
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className="faq-item" data-open={isOpen}>
            <h3>
              <button
                type="button"
                id={`question-${index}`}
                aria-expanded={isOpen}
                aria-controls={`answer-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <span className="faq-toggle" aria-hidden="true"><i /><i /></span>
              </button>
            </h3>
            <div id={`answer-${index}`} className="faq-answer" role="region" aria-labelledby={`question-${index}`} inert={!isOpen}>
              <div><p>{item.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
