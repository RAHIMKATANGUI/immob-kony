import { prisma, type Tx } from "./prisma";

/** Incrément atomique d'un compteur métier. */
export async function nextSequence(key: string, db: Tx = prisma): Promise<number> {
  const row = await db.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

const pad = (n: number, size: number) => String(n).padStart(size, "0");

export async function nextCode(prefix: "PRO" | "RES" | "LOC", db: Tx = prisma) {
  return `${prefix}-${pad(await nextSequence(prefix, db), 5)}`;
}

export async function nextLeaseReference(db: Tx = prisma, year = new Date().getUTCFullYear()) {
  return `BAIL-${year}-${pad(await nextSequence(`LEASE-${year}`, db), 5)}`;
}

export async function nextReceiptNumber(db: Tx = prisma, year = new Date().getUTCFullYear()) {
  return `REC-${year}-${pad(await nextSequence(`RECEIPT-${year}`, db), 6)}`;
}
