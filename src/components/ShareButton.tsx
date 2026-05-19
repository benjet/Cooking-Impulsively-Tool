"use client";

import { useState } from "react";

export function ShareButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}/c/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }
  return (
    <button
      onClick={copy}
      className="text-sm border border-stone-300 rounded px-3 py-1.5 hover:bg-stone-50"
    >
      {copied ? "Link copied!" : "Copy share link"}
    </button>
  );
}
