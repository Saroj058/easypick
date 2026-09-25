import { getProducts } from "@/lib/store";

// The public catalogue for instant search in the header, fetched once when search opens.
export const revalidate = 60;

export async function GET() {
  // Only what search shows and filters on: the first photo, no long details.
  const list = (await getProducts()).map((p) => ({ ...p, details: [], images: p.images.slice(0, 1) }));
  return Response.json(list);
}
