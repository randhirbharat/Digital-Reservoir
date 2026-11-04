"use client";
import { useState, type FormEvent } from "react";

type Status = { kind: "idle" | "sending" | "ok" | "error"; message?: string };

export function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries()) as Record<string, string>;
    const errs: Record<string, string> = {};
    if (!data.name?.trim()) errs.name = "Enter your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email || "")) errs.email = "Enter a valid email address.";
    if ((data.message || "").trim().length < 20) errs.message = "Please describe your enquiry in at least 20 characters.";
    if (!data.consent) errs.consent = "Please confirm you are authorised to share this information.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/v1/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "DigitalReservoir" },
        body: JSON.stringify({ name: data.name, email: data.email, organisation: data.organisation || "", topic: data.topic, message: data.message, website: data.website || "" }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "Too many messages — please try again later." : "The message could not be sent.");
      setStatus({ kind: "ok", message: "Thank you — your enquiry has been received. We will reply by email." });
      e.currentTarget.reset();
    } catch (err) {
      setStatus({ kind: "error", message: `${(err as Error).message} You can also email the address shown on this page.` });
    }
  }

  const field = "dr-field";
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-1">
      <div className="grid gap-x-4 sm:grid-cols-2 grid-cols-1 min-w-0">
        <div><label className="dr-label" htmlFor="c-name">Name</label><input id="c-name" name="name" autoComplete="name" className={field} aria-invalid={!!errors.name} aria-describedby={errors.name ? "e-name" : undefined} />{errors.name ? <p id="e-name" className="text-sm text-cond-critical mt-1">{errors.name}</p> : null}</div>
        <div><label className="dr-label" htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" autoComplete="email" className={field} aria-invalid={!!errors.email} aria-describedby={errors.email ? "e-email" : undefined} />{errors.email ? <p id="e-email" className="text-sm text-cond-critical mt-1">{errors.email}</p> : null}</div>
        <div><label className="dr-label" htmlFor="c-org">Organisation (optional)</label><input id="c-org" name="organisation" autoComplete="organization" className={field} /></div>
        <div><label className="dr-label" htmlFor="c-topic">Topic</label>
          <select id="c-topic" name="topic" className={field}><option>Research collaboration</option><option>Pilot project / monitoring</option><option>Engineering Lab support</option><option>Digital Twin project access</option><option>Other</option></select></div>
      </div>
      <label className="dr-label" htmlFor="c-msg">Message</label>
      <textarea id="c-msg" name="message" rows={5} className={field} aria-invalid={!!errors.message} aria-describedby="h-msg" />
      <p id="h-msg" className={`text-sm ${errors.message ? "text-cond-critical" : "text-muted"}`}>{errors.message || "Please do not send confidential monitoring data through this form."}</p>
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 pt-3 text-sm"><input type="checkbox" name="consent" className="mt-1 size-4" /> I am authorised to share this information and agree to be contacted about this enquiry.</label>
      {errors.consent ? <p className="text-sm text-cond-critical">{errors.consent}</p> : null}
      <div className="pt-4"><button type="submit" disabled={status.kind === "sending"} className="min-h-[48px] rounded-[10px] bg-accent px-6 font-semibold text-on-accent disabled:opacity-60">{status.kind === "sending" ? "Sending…" : "Send enquiry"}</button></div>
      <p role="status" aria-live="polite" className={`pt-2 text-sm ${status.kind === "error" ? "text-cond-critical" : "text-cond-normal"}`}>{status.message}</p>
    </form>
  );
}
