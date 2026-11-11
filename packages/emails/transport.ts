import { render } from "@react-email/components";
import { createTransport, type Transporter } from "nodemailer";
import type { ReactElement } from "react";
import { Resend } from "resend";

import { env } from "@quenti/env/server";

export interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  react: ReactElement;
}

/**
 * Emails are delivered through the first configured transport:
 *   1. Resend, if RESEND_API_KEY is set
 *   2. SMTP, if SMTP_HOST is set
 *   3. Otherwise the email is printed to the server console, which is enough
 *      for small self-hosted instances (e.g. to grab a magic sign-in link).
 */
export const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;

let smtp: Transporter | null = null;
const getSmtp = () => {
  if (!env.SMTP_HOST) return null;
  if (!smtp) {
    const secure = env.SMTP_SECURE ?? env.SMTP_PORT === 465;
    smtp = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? (secure ? 465 : 587),
      secure,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return smtp;
};

export const sendEmail = async (opts: SendEmailOptions) => {
  if (resend) {
    await resend.sendEmail({
      ...opts,
      to: env.USE_RESEND_PREVIEWS ? "delivered@resend.dev" : opts.to,
    });
    return;
  }

  const transporter = getSmtp();
  if (transporter) {
    await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: render(opts.react),
      text: render(opts.react, { plainText: true }),
    });
    return;
  }

  const recipients = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
  console.log(
    [
      "",
      "========== Email (no RESEND_API_KEY or SMTP_HOST configured) ==========",
      `To:      ${recipients}`,
      `Subject: ${opts.subject}`,
      "",
      render(opts.react, { plainText: true }),
      "=======================================================================",
      "",
    ].join("\n"),
  );
};
