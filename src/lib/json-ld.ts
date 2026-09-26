// Structured data (schema.org) for <script type="application/ld+json">. "<" is escaped so a
// product name or FAQ text containing "</script>" can never end the tag early.

export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
