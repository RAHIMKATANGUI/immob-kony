import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Configuration Prisma CLI (migrations, seed).
 * Le client applicatif utilise le moteur "client" (sans binaire Rust) + l'adaptateur pg :
 * voir src/lib/prisma.ts.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
