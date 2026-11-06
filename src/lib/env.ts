import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit contenir au moins 32 caractères"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("IMMOB KONY"),
  CURRENCY: z.string().default("XOF"),
  CRON_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("IMMOB KONY <noreply@immobkony.com>"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMS_PROVIDER: z.enum(["console", "twilio", "http"]).default("console"),
  SMS_API_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER: z.string().default("IMMOBKONY"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

/** Variables d'environnement validées (chargées paresseusement côté serveur). */
export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
