// Shrinks a picked photo in the browser before upload: hosting limits requests to ~4 MB,
// and phone photos are often bigger. Keeps it at most 1800 px on the long side, JPEG 85%.
// Replaces the file on the <input> so the form sends the small one.

const MAX_SIDE = 1800;
const MAX_BYTES = 2.5 * 1024 * 1024;

export async function shrinkPhotoInput(input: HTMLInputElement): Promise<File | null> {
  const file = input.files?.[0];
  if (!file || !file.type.startsWith("image/")) return file ?? null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) return file;
  const small = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  const dt = new DataTransfer();
  dt.items.add(small);
  input.files = dt.files;
  return small;
}
