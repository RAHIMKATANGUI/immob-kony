/**
 * Hook de démarrage Next.js : crée le premier administrateur si nécessaire
 * (variables ADMIN_EMAIL et ADMIN_PASSWORD définies dans Render).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapAdmin } = await import("./lib/bootstrap-admin");
    await bootstrapAdmin();
  }
}
