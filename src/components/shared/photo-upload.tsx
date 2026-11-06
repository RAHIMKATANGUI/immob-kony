"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, HttpError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Upload d'image (Cloudinary) avec aperçu. */
export function PhotoUpload({ value, onChange, folder = "tenants", label = "Photo", round = true }: { value?: string | null; onChange: (url: string | null) => void; folder?: string; label?: string; round?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const { url } = await uploadFile(file, folder);
      onChange(url);
    } catch (e) {
      toast.error(e instanceof HttpError ? e.message : "Échec de l'upload");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn("relative flex size-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed bg-muted/50 transition hover:border-brand", round ? "rounded-full" : "rounded-2xl")}
      >
        {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="size-full object-cover" />
        ) : <Camera className="size-6 text-muted-foreground" />}
      </button>
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">JPEG, PNG ou WEBP — 5 Mo max.</p>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="mt-1 inline-flex items-center gap-1 text-xs text-destructive hover:underline">
            <X className="size-3" /> Retirer
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
