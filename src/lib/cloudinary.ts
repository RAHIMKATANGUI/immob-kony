import "server-only";
import { v2 as cloudinary } from "cloudinary";

export const cloudinaryEnabled = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export async function uploadToCloudinary(buffer: Buffer, folder: string, resourceType: "image" | "raw" | "auto" = "auto") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `immob-kony/${folder}`, resource_type: resourceType, transformation: resourceType === "image" ? [{ width: 800, height: 800, crop: "limit", quality: "auto" }] : undefined },
      (err, res) => (err || !res ? reject(err ?? new Error("Upload échoué")) : resolve({ url: res.secure_url, publicId: res.public_id })),
    );
    stream.end(buffer);
  });
}
