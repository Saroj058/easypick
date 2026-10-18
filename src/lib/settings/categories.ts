import "server-only";

import { cleanKinds, DEFAULT_KINDS } from "./categories-rules";
import { defineSetting } from "./define";

/** Names, order, pictures and visibility of the kinds (Admin → Categories). */
export const kindsSetting = defineSetting({ key: "kinds", tag: "kinds", defaults: DEFAULT_KINDS, clean: cleanKinds });
