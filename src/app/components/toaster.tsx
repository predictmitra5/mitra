"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT } from "./feed/needs-account";

/** A short message at the bottom of the screen ("Link copied"), gone after a few seconds. */
export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function show(event: Event) {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text !== "string" || !text) return;
      setMessage(text);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 3200);
    }
    window.addEventListener(TOAST_EVENT, show);
    return () => { window.removeEventListener(TOAST_EVENT, show); clearTimeout(timer); };
  }, []);
  return <div className="toast-host" role="status" aria-live="polite">{message && <p className="toast" key={message}>{message}</p>}</div>;
}
