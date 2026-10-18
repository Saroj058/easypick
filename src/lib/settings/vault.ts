import "server-only";

import { defineSetting } from "./define";
import { cleanVault, DEFAULT_VAULT } from "./vault-rules";

/** The Vault's brand colours, stories, words and featured pieces (Admin → The Vault). */
export const vaultSetting = defineSetting({ key: "vault", tag: "vault", defaults: DEFAULT_VAULT, clean: cleanVault });
