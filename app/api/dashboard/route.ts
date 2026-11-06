import { route } from "@/lib/api";
import { getDashboard } from "@/lib/services/dashboard.service";

export const GET = route({}, async ({ session }) => getDashboard(session));
