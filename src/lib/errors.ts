export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const unauthorized = (m = "Authentification requise") => new ApiError(401, m);
export const forbidden = (m = "Accès refusé") => new ApiError(403, m);
export const notFound = (m = "Ressource introuvable") => new ApiError(404, m);
export const badRequest = (m: string, d?: unknown) => new ApiError(400, m, d);
export const conflict = (m: string) => new ApiError(409, m);
export const tooMany = (m = "Trop de requêtes, réessayez plus tard") => new ApiError(429, m);
