/**
 * Exécution des relances en ligne de commande (alternative au endpoint /api/cron/reminders).
 *   npm run cron:reminders
 */
import "dotenv/config";
import { runReminders } from "../src/lib/services/reminder.service";
import { prisma } from "../src/lib/prisma";

runReminders()
  .then((r) => console.log("[relances]", JSON.stringify(r)))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
