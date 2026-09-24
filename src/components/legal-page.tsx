import { PageIntro } from "./page-intro";

// Policy pages. Drafts in plain language — have a lawyer or CA review every page
// before launch (see the Website doc, "Policies and legal pages").

export function LegalPage({ title, lead, updated, children }: { title: string; lead: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageIntro eyebrow={`Updated ${updated}`} title={title} lead={lead} />
      <article className="container-ep prose-ep max-w-3xl pb-24">{children}</article>
    </>
  );
}
