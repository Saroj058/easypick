import "server-only";

import { defineSetting } from "./define";
import { cleanSite, DEFAULT_SITE } from "./site-rules";

/** Social links, the announcement, search description and the footer box (Admin → Site settings). */
export const siteSetting = defineSetting({ key: "site", tag: "site", defaults: DEFAULT_SITE, clean: cleanSite });
