import "server-only";

import { defineSetting } from "./define";
import { cleanHome, DEFAULT_HOME } from "./home-rules";

/** The home page's sections and copy (Admin → Home page). */
export const homeSetting = defineSetting({ key: "home", tag: "home", defaults: DEFAULT_HOME, clean: cleanHome });
