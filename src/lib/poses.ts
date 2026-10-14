/**
 * Pieces photographed on the white mannequin (public/poses/<slug>-<n>.webp, made in Canva from each
 * piece's own photo, owner's choice 14 Oct 2026), and how many poses each has. They show on the
 * product page as extra views after the piece's own photos. A new pose: add the file and its count.
 */
export const POSES: Record<string, number> = {
  "coach-jacket": 3,
};

export const posesFor = (slug: string): string[] => Array.from({ length: POSES[slug] ?? 0 }, (_, i) => `/poses/${slug}-${i + 1}.webp`);
