"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      form.reset();
      setStatus("success");
      setMessage("Message sent. I’ll get back to you shortly.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Message could not be sent.");
    }
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <div className="field-row">
        <label>
          <span>Name</span>
          <input name="name" required autoComplete="name" />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
      </div>
      <label>
        <span>Company or project</span>
        <input name="company" autoComplete="organization" />
      </label>
      <label>
        <span>What needs to move forward?</span>
        <textarea name="message" rows={6} required />
      </label>
      <label>
        <span>Budget range <em>optional</em></span>
        <select name="budget" defaultValue="">
          <option value="" disabled>Select a range</option>
          <option>Under ₹50,000</option>
          <option>₹50,000–₹1,50,000</option>
          <option>₹1,50,000–₹5,00,000</option>
          <option>₹5,00,000+</option>
          <option>Not defined yet</option>
        </select>
      </label>
      <input className="honeypot" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="form-footer">
        <button className="button button-primary" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send project brief"}
        </button>
        <p className={`form-status ${status}`} aria-live="polite">{message}</p>
      </div>
    </form>
  );
}
