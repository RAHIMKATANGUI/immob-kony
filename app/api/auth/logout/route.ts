import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { json } from "@/lib/api";

export async function POST() {
  const session = await getSession();
  if (session) await audit({ session }, "LOGOUT", "User", session.sub);
  await clearSessionCookie();
  return json({ ok: true });
}
