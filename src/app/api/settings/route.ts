import { parseBody, route } from "@/lib/api";
import { settingsSchema } from "@/lib/validations";
import { getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const GET = route({}, async () => getSettings());

export const PUT = route({ permission: "settings:write" }, async (ctx) => {
  const before = await getSettings();
  const data = await parseBody(ctx.req, settingsSchema);
  const after = await saveSettings(data);
  await audit(ctx, "UPDATE", "Setting", null, before, after);
  return after;
});
