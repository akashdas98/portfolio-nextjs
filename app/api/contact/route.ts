import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100, "Name must be 100 characters or fewer."),
  email: z.string().trim().email("Enter a valid email address."),
  company: z.string().trim().max(150, "Company or project must be 150 characters or fewer.").optional().default(""),
  message: z
    .string()
    .trim()
    .min(20, "Share at least 20 characters about the project.")
    .max(5000, "Message must be 5000 characters or fewer."),
  budget: z.string().trim().max(100, "Budget range must be 100 characters or fewer.").optional().default(""),
  website: z.string().max(0).optional().default(""),
});

function getValidationErrors(error: z.ZodError) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && field !== "website" && !errors[field]) {
      errors[field] = issue.message;
    }
    return errors;
  }, {});
}

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    if (data.website) return NextResponse.json({ ok: true });

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL;
    const from = process.env.CONTACT_FROM_EMAIL;

    if (!apiKey || !to || !from) {
      return NextResponse.json(
        { error: "Contact form is not configured yet. Please email directly instead." },
        { status: 503 },
      );
    }

    const supabase = createSupabaseAdminClient();
    if (supabase) {
      const { error: leadError } = await supabase.from("leads").insert({
        name: data.name,
        email: data.email,
        company: data.company || null,
        budget: data.budget || null,
        message: data.message,
        source: "portfolio-contact-form",
        status: "new",
        priority: "normal",
      });

      if (leadError) {
        console.error("Lead capture failed", leadError);
      }
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      replyTo: data.email,
      subject: `New work enquiry from ${data.name}`,
      text: [
        "New portfolio work enquiry",
        "",
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        `Company/project: ${data.company || "Not provided"}`,
        `Budget: ${data.budget || "Not provided"}`,
        "",
        data.message,
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = getValidationErrors(error);
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields.",
          errors,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Message could not be sent. Please email directly." }, { status: 500 });
  }
}
