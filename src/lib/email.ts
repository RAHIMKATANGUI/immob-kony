import "server-only";
import { Resend } from "resend";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

let client: Resend | null = null;

/** Envoi d'email via Resend. Sans clé API, l'email est journalisé (mode développement). */
export async function sendEmail(mail: MailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "IMMOB KONY <noreply@immobkony.com>";
  if (!key) {
    console.info(`[email:dev] → ${mail.to} | ${mail.subject}`);
    return { ok: true, id: "dev-log" };
  }
  client ??= new Resend(key);
  const { data, error } = await client.emails.send({
    from,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Gabarit HTML sobre aux couleurs IMMOB KONY. */
export function emailTemplate(title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:#334155">${esc(p)}</p>`).join("");
  const button = cta
    ? `<a href="${esc(cta.url)}" style="display:inline-block;background:#14b8a6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(cta.label)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Inter,Segoe UI,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0b1222;padding:20px 28px;color:#fff;font-weight:700;letter-spacing:.08em">IMMOB <span style="color:#2dd4bf">KONY</span></td></tr>
    <tr><td style="padding:28px">
      <h1 style="font-size:20px;margin:0 0 18px;color:#0b1222">${esc(title)}</h1>
      ${body}${button}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;color:#94a3b8;font-size:12px">Message automatique — merci de ne pas répondre directement.</td></tr>
  </table></td></tr></table></body></html>`;
}
