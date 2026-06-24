import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  company: z.string().trim().max(150).optional().default(""),
  message: z.string().trim().min(20).max(5000),
  budget: z.string().trim().max(100).optional().default(""),
  website: z.string().max(0).optional().default(""),
});

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

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      replyTo: data.email,
      subject: `Portfolio enquiry from ${data.name}`,
      text: [
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
      return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
    }
    return NextResponse.json({ error: "Message could not be sent. Please email directly." }, { status: 500 });
  }
}
