import "server-only";

/**
 * Passerelle SMS (intégration préparée).
 * - console : journalisation (par défaut)
 * - twilio  : API Twilio (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / SMS_SENDER)
 * - http    : passerelle générique (Orange, MTN, Infobip…) via SMS_API_URL + SMS_API_KEY
 */
export interface SmsResult { ok: boolean; id?: string; error?: string }

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "console";
  const text = message.slice(0, 459); // 3 segments max
  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: process.env.SMS_SENDER ?? "IMMOBKONY", Body: text }),
      });
      const data = (await res.json()) as { sid?: string; message?: string };
      return res.ok ? { ok: true, id: data.sid } : { ok: false, error: data.message };
    }
    if (provider === "http") {
      const res = await fetch(process.env.SMS_API_URL!, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, from: process.env.SMS_SENDER ?? "IMMOBKONY", text }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    }
    console.info(`[sms:dev] → ${to} | ${text}`);
    return { ok: true, id: "dev-log" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
