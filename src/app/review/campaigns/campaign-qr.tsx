"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export function CampaignQr({ claimPath, notice }: { claimPath: string; notice: string }) {
  const qrRef = useRef<SVGSVGElement>(null);
  const qrUrl = typeof window === "undefined" ? "" : new URL(claimPath, window.location.origin).toString();

  function downloadQr() {
    const svg = qrRef.current;
    if (!svg) return;
    const file = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = href;
    link.download = "mitra-campus-claim-qr.svg";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  return <div className="campaign-qr-result" role="status">
    <div><strong>{notice}</strong><p>Copy or download this QR now. The private link won’t be shown again; replacing it disables the previous QR.</p></div>
    {qrUrl && <>
      <div className="campaign-qr"><QRCodeSVG ref={qrRef} value={qrUrl} size={240} level="Q" marginSize={4} title="Campus campaign claim QR code" /></div>
      <a className="campaign-link" href={qrUrl}>{qrUrl}</a>
      <button type="button" className="btn btn-quiet campaign-download" onClick={downloadQr}>Download QR image</button>
    </>}
  </div>;
}
