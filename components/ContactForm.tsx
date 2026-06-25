"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";
type FieldName = "name" | "email" | "company" | "message" | "budget";
type FieldErrors = Partial<Record<FieldName | "form", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getValue(formData: FormData, field: FieldName) {
  return String(formData.get(field) ?? "").trim();
}

function validateContactForm(formData: FormData) {
  const errors: FieldErrors = {};
  const values = {
    name: getValue(formData, "name"),
    email: getValue(formData, "email"),
    company: getValue(formData, "company"),
    message: getValue(formData, "message"),
    budget: getValue(formData, "budget"),
  };

  if (values.name.length < 2) {
    errors.name = "Enter your name.";
  } else if (values.name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  if (!values.email) {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (values.company.length > 150) {
    errors.company = "Company or project must be 150 characters or fewer.";
  }

  if (values.message.length < 20) {
    errors.message = "Share at least 20 characters about the project.";
  } else if (values.message.length > 5000) {
    errors.message = "Message must be 5000 characters or fewer.";
  }

  if (values.budget.length > 100) {
    errors.budget = "Budget range must be 100 characters or fewer.";
  }

  return { errors, values };
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    const { errors: nextErrors, values } = validateContactForm(formData);

    if (Object.keys(nextErrors).length) {
      setStatus("error");
      setErrors(nextErrors);
      setMessage("Please fix the highlighted fields.");
      return;
    }

    setStatus("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          website: String(formData.get("website") ?? ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors && typeof data.errors === "object") {
          setErrors(data.errors);
        }
        throw new Error(data.error || "Message could not be sent.");
      }

      form.reset();
      setStatus("success");
      setMessage("Message sent. I'll get back to you shortly.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Message could not be sent.");
    }
  }

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      <div className="field-row">
        <label className={errors.name ? "has-error" : undefined}>
          <span>Name</span>
          <input
            name="name"
            required
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name ? (
            <strong id="contact-name-error" className="field-error">
              {errors.name}
            </strong>
          ) : null}
        </label>
        <label className={errors.email ? "has-error" : undefined}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email ? (
            <strong id="contact-email-error" className="field-error">
              {errors.email}
            </strong>
          ) : null}
        </label>
      </div>
      <label className={errors.company ? "has-error" : undefined}>
        <span>Company or project</span>
        <input
          name="company"
          maxLength={150}
          aria-invalid={Boolean(errors.company)}
          aria-describedby={errors.company ? "contact-company-error" : undefined}
        />
        {errors.company ? (
          <strong id="contact-company-error" className="field-error">
            {errors.company}
          </strong>
        ) : null}
      </label>
      <label className={errors.message ? "has-error" : undefined}>
        <span>What needs to move forward?</span>
        <textarea
          name="message"
          rows={6}
          required
          minLength={20}
          maxLength={5000}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message ? (
          <strong id="contact-message-error" className="field-error">
            {errors.message}
          </strong>
        ) : null}
      </label>
      <label className={errors.budget ? "has-error" : undefined}>
        <span>
          Budget range <em>optional</em>
        </span>
        <select
          name="budget"
          defaultValue=""
          aria-invalid={Boolean(errors.budget)}
          aria-describedby={errors.budget ? "contact-budget-error" : undefined}
        >
          <option value="" disabled>
            Select a range
          </option>
          <option>Under INR 50,000</option>
          <option>INR 50,000-INR 1,50,000</option>
          <option>INR 1,50,000-INR 5,00,000</option>
          <option>INR 5,00,000+</option>
          <option>Not defined yet</option>
        </select>
        {errors.budget ? (
          <strong id="contact-budget-error" className="field-error">
            {errors.budget}
          </strong>
        ) : null}
      </label>
      <input
        className="honeypot"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="form-footer">
        <button className="button button-primary" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending..." : "Send Project Brief"}
        </button>
        <p className={`form-status ${status}`} aria-live="polite">
          {errors.form || message}
        </p>
      </div>
    </form>
  );
}
