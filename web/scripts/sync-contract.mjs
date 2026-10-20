// Copies the shared contract (vocab.json) from ../data/schema into web/lib.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../data/schema/vocab.json");
const dest = resolve(here, "../lib/vocab.json");
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`sync-contract: ${src} -> ${dest}`);
