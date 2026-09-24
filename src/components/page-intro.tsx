/**
 * Calm page header: one headline, one line of text. Always light, so inner pages
 * feel quiet next to the home page. (`dark` is kept for callers but no longer used.)
 */
export function PageIntro({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string; dark?: boolean }) {
  return (
    <section className="pb-8 pt-14 md:pb-12 md:pt-24">
      <div className="container-ep">
        {eyebrow && <p className="text-[15px] font-semibold text-steel-dark">{eyebrow}</p>}
        <h1 className="display display-h1 mt-2">{title}</h1>
        {lead && <p className="mt-4 max-w-[46ch] text-lg text-steel-dark md:text-xl">{lead}</p>}
      </div>
    </section>
  );
}
