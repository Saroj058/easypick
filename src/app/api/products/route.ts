import { getProducts } from "@/lib/store";

// The public catalogue for instant search in the header, fetched once when search opens.
export const revalidate = 60;

export async function GET() {
  return Response.json(await getProducts());
}
