"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Smartphone, X } from "lucide-react";

// Configured LAN address, e.g. http://192.168.31.100:3000. Inlined at build time.
const LAN_URL = process.env.NEXT_PUBLIC_APP_URL;

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1"
  );
}

/**
 * Floating entry that reveals a QR code for LAN access. Shown on desktop only:
 * the typical flow is opening the site on a computer and scanning with a phone.
 *
 * QR target is chosen so a phone can actually reach it:
 *  - viewed on localhost -> use the configured LAN address (NEXT_PUBLIC_APP_URL)
 *  - otherwise           -> use the current origin (works on LAN IP / public domain)
 */
export function LanAccessQr() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHostname(window.location.hostname);
    setOrigin(window.location.origin);
  }, []);

  if (!mounted) return null;

  // Prefer the LAN address when the page is opened locally, so the phone has a
  // routable URL to scan. Fall back to the current origin otherwise.
  let targetUrl = origin;
  const lanUrl = LAN_URL ?? "";
  if (isLocalHost(hostname) && lanUrl) {
    try {
      const lanHost = new URL(lanUrl).hostname;
      if (!isLocalHost(lanHost)) targetUrl = lanUrl;
    } catch {
      /* keep origin */
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="局域网访问二维码"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 hidden sm:flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/70 bg-white/80 text-slate-700 shadow-lg backdrop-blur transition hover:scale-110 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:text-white"
      >
        <QrCode className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="局域网访问二维码"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-2xl dark:bg-slate-900"
          >
            <button
              type="button"
              aria-label="关闭"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-1 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Smartphone className="h-4 w-4" />
              扫码用手机访问
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">同一局域网内打开手机相机扫码</p>

            <div className="mx-auto mb-4 flex justify-center rounded-xl bg-white p-3">
              <QRCodeSVG value={targetUrl} size={208} level="M" includeMargin={false} />
            </div>

            <button
              type="button"
              onClick={copyUrl}
              className="mx-auto flex max-w-full items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="truncate">{targetUrl}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
