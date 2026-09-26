// Free text from a gift buyer ends up in texts and email subjects sent to someone else,
// so keep it to plain words: no links, no control characters.

// Control characters (tabs and newlines included) and invisible direction marks.
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;
// Anything that looks like a link: scheme://…, www.…, or a bare domain like evil.com/x.
const LINK = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|biz|io|co|me|ly|xyz|site|online|top|app|link|click|np|in)\b(?:\/\S*)?/gi;

/** A person's name as shown in a gift: letters, spaces and . ' - only, up to 40 (or `max`). Null if nothing is left. */
export function cleanSenderName(input: string | null | undefined, max = 40): string | null {
  const name = String(input ?? "")
    .replace(CONTROL, " ")
    .replace(LINK, " ")
    .replace(/[^\p{L}\p{M} .'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return /\p{L}/u.test(name) ? name : null;
}

/** A gift message: the words stay, links become "[link removed]", line breaks become spaces. */
export function cleanGiftMessage(input: string | null | undefined, max = 200): string {
  return String(input ?? "")
    .replace(CONTROL, " ")
    .replace(LINK, "[link removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
