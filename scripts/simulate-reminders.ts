/**
 * Simulation des relances à une date donnée (tests / démonstration).
 *   npx tsx --conditions=react-server scripts/simulate-reminders.ts 2026-12-02
 */
import "dotenv/config";
import { runReminders } from "../src/lib/services/reminder.service";
import { prisma } from "../src/lib/prisma";

const date = process.argv[2] ? new Date(`${process.argv[2]}T00:00:00Z`) : new Date();
runReminders(date)
  .then(async (r) => {
    console.log(`[simulation ${date.toISOString().slice(0, 10)}]`, JSON.stringify(r));
    const sample = await prisma.notification.findFirst({ where: { channel: "EMAIL" }, orderBy: { createdAt: "desc" } });
    if (sample) console.log("Exemple :", sample.title);
  })
  .finally(() => prisma.$disconnect());
