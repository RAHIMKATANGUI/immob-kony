import { route } from "@/lib/api";
import { badRequest, ApiError } from "@/lib/errors";
import { cloudinaryEnabled, uploadToCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

const MAX = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const FOLDERS = new Set(["tenants", "documents", "residences", "signatures", "avatars"]);

/** Upload de fichiers (photo, pièce d'identité, signature) vers Cloudinary. */
export const POST = route({ rateLimit: 30 }, async ({ req }) => {
  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "documents");
  if (!(file instanceof File)) throw badRequest("Fichier manquant");
  if (!FOLDERS.has(folder)) throw badRequest("Dossier invalide");
  if (!TYPES.has(file.type)) throw badRequest("Format non autorisé (JPEG, PNG, WEBP ou PDF)");
  if (file.size > MAX) throw badRequest("Fichier trop volumineux (5 Mo max.)");
  const buffer = Buffer.from(await file.arrayBuffer());

  // vérification de la signature binaire (le type MIME déclaré peut être falsifié)
  const head = buffer.subarray(0, 12).toString("hex");
  const valid = head.startsWith("ffd8ff") || head.startsWith("89504e47") || head.startsWith("25504446") || (head.startsWith("52494646") && head.slice(16, 24) === "57454250");
  if (!valid) throw badRequest("Contenu de fichier invalide");

  if (cloudinaryEnabled()) {
    const res = await uploadToCloudinary(buffer, folder, file.type === "application/pdf" ? "raw" : "image");
    return { url: res.url, publicId: res.publicId };
  }
  if (process.env.NODE_ENV === "production") throw new ApiError(503, "Stockage Cloudinary non configuré");
  // Développement : data URL (limité à 1 Mo)
  if (file.size > 1024 * 1024) throw badRequest("Sans Cloudinary, 1 Mo max. en développement");
  return { url: `data:${file.type};base64,${buffer.toString("base64")}`, publicId: null };
});
