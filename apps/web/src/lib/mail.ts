import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const g = globalThis as unknown as { __retrouveMails?: Mail[]; __retrouveTransport?: Transporter };

/** Emails « envoyés » quand le SMTP n'est pas configuré (développement et tests). */
export function sentMails(): Mail[] {
  return (g.__retrouveMails ??= []);
}

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function transport(): Transporter {
  if (!g.__retrouveTransport) {
    const port = Number(process.env.SMTP_PORT || 465);
    g.__retrouveTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return g.__retrouveTransport;
}

/** Envoie un email via Gmail (SMTP). Ne lève jamais d'erreur : renvoie false en cas d'échec. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) {
    if (process.env.VERCEL) {
      // En ligne : on ne garde ni n'affiche le contenu (il peut contenir un lien de réinitialisation).
      console.warn(`Email non envoyé (SMTP_USER / SMTP_PASSWORD non configurés) : ${mail.subject}`);
      return false;
    }
    const box = sentMails();
    box.push(mail);
    if (box.length > 50) box.shift();
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email non envoyé : SMTP non configuré] À ${mail.to} : ${mail.subject}\n${mail.text}`);
    }
    return false;
  }
  try {
    await transport().sendMail({
      from: process.env.MAIL_FROM || `Retrouve <${process.env.SMTP_USER}>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return true;
  } catch (err) {
    console.error("Email non envoyé :", (err as Error).message);
    return false;
  }
}
