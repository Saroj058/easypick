import type { Metadata } from "next";

import { FitFinder } from "@/components/fit-finder";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Easypick size charts in cm for tees, hoodies, joggers and jeans. Measure once, pick with confidence.",
  alternates: { canonical: "/size-guide" },
};

type Row = { size: string; [k: string]: string | number };

const charts: { title: string; note: string; cols: [string, string][]; rows: Row[] }[] = [
  {
    title: "Oversized tees",
    note: "Cut roomy on purpose. Size down for a closer fit.",
    cols: [["chest", "Chest"], ["length", "Length"], ["sleeve", "Sleeve"]],
    rows: [
      { size: "S", chest: 108, length: 70, sleeve: 23 },
      { size: "M", chest: 114, length: 72, sleeve: 24 },
      { size: "L", chest: 120, length: 74, sleeve: 25 },
      { size: "XL", chest: 126, length: 76, sleeve: 26 },
    ],
  },
  {
    title: "Hoodies and sweats",
    note: "Room for a tee underneath. True to size for a relaxed look.",
    cols: [["chest", "Chest"], ["length", "Length"], ["sleeve", "Sleeve"]],
    rows: [
      { size: "S", chest: 116, length: 68, sleeve: 58 },
      { size: "M", chest: 122, length: 70, sleeve: 60 },
      { size: "L", chest: 128, length: 72, sleeve: 62 },
      { size: "XL", chest: 134, length: 74, sleeve: 63 },
    ],
  },
  {
    title: "Joggers and cargos",
    note: "Elastic waist stretches about 8 cm.",
    cols: [["waist", "Waist"], ["length", "Length"], ["inseam", "Inseam"]],
    rows: [
      { size: "S", waist: 70, length: 98, inseam: 72 },
      { size: "M", waist: 76, length: 100, inseam: 74 },
      { size: "L", waist: 82, length: 102, inseam: 76 },
      { size: "XL", waist: 88, length: 104, inseam: 77 },
    ],
  },
  {
    title: "Jeans",
    note: "Rigid denim. Pick your usual waist; they soften with wear.",
    cols: [["waist", "Waist"], ["length", "Length"], ["inseam", "Inseam"]],
    rows: [
      { size: "S (30)", waist: 76, length: 104, inseam: 78 },
      { size: "M (32)", waist: 81, length: 106, inseam: 79 },
      { size: "L (34)", waist: 86, length: 108, inseam: 80 },
      { size: "XL (36)", waist: 91, length: 110, inseam: 81 },
    ],
  },
];

export default function SizeGuidePage() {
  return (
    <>
      <PageIntro eyebrow="Size guide" title="Find your fit." lead="Measure once, pick with confidence. All measurements are of the garment laid flat, in cm." />

      <div className="container-ep pb-24">
        <section aria-labelledby="fit-title" className="bg-photo p-6 md:p-10">
          <h2 id="fit-title" className="display display-h2">
            Measure once. We match every piece.
          </h2>
          <p className="mt-2 max-w-[52ch] text-steel-dark">
            Measure a tee or trousers you already love. Every product page then marks the size closest to yours, in cm, not guesswork.
          </p>
          <div className="mt-8">
            <FitFinder />
          </div>
        </section>

        <div className="mt-16 grid gap-16 md:grid-cols-2">
          {charts.map((c) => (
            <section key={c.title}>
              <h2 className="display text-[28px] md:text-[36px]">{c.title}</h2>
              <p className="mt-1 text-[15px] text-steel-dark">{c.note}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full font-mono text-[15px]">
                  <thead>
                    <tr className="text-left text-steel-dark">
                      <th scope="col" className="py-2 pr-4 font-normal">
                        Size
                      </th>
                      {c.cols.map(([k, l]) => (
                        <th key={k} scope="col" className="py-2 pr-4 font-normal">
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr key={r.size} className="border-t border-mist">
                        <th scope="row" className="py-3 pr-4 text-left font-semibold">
                          {r.size}
                        </th>
                        {c.cols.map(([k]) => (
                          <td key={k} className="py-3 pr-4">
                            {r[k]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 max-w-xl text-steel-dark">
          Every product page has its own measurements and a note on what size the model wears. Still unsure? Try it in store. That&apos;s what
          the fitting rooms are for.
        </p>
      </div>
    </>
  );
}
