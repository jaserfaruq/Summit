"use client";

import { useState } from "react";

export default function PartnerInviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/partners/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invite");
      }

      setSuccess(`Invite sent to ${data.recipientName}`);
      setEmail("");
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-start">
      <div className="flex-1">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); setSuccess(null); }}
          placeholder="Partner's email address"
          className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-dark-muted focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50"
          disabled={sending}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        {success && <p className="text-xs text-green-400 mt-1">{success}</p>}
      </div>
      <button
        type="submit"
        disabled={sending || !email.trim()}
        className="bg-forest hover:bg-forest/80 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {sending ? "Sending..." : "Add Partner"}
      </button>
    </form>
  );
}
