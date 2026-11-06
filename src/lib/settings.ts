import "server-only";
import { prisma } from "./prisma";
import { DEFAULT_CLAUSES } from "./settings.shared";

export { DEFAULT_CLAUSES };

export interface AgencySettings {
  agencyName: string;
  agencyAddress: string | null;
  agencyPhone: string | null;
  agencyEmail: string | null;
  currency: string;
  defaultClauses: string | null;
  remindersEnabled: boolean;
}



const DEFAULTS: AgencySettings = {
  agencyName: process.env.APP_NAME ?? "IMMOB KONY",
  agencyAddress: null,
  agencyPhone: null,
  agencyEmail: null,
  currency: process.env.CURRENCY ?? "XOF",
  defaultClauses: DEFAULT_CLAUSES,
  remindersEnabled: true,
};

export async function getSettings(): Promise<AgencySettings> {
  const rows = await prisma.setting.findMany();
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as AgencySettings;
}

export async function saveSettings(values: Partial<AgencySettings>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } }),
    ),
  );
  return getSettings();
}
