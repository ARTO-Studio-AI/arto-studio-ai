import { readFileSync } from "node:fs";
import path from "node:path";

/* Load .env.local from the project root (one dir up from lib/). Mirrors the
 * arto-image-service loader: launchd does not inherit shell env, so the
 * service reads its own .env.local. Only sets keys not already present so
 * the plist's EnvironmentVariables win when set. */
export function loadEnv() {
  try {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      let v = line.slice(i + 1);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[line.slice(0, i)] === undefined) process.env[line.slice(0, i)] = v;
    }
  } catch {
    // .env.local optional — fall back to whatever the environment provided.
  }
}
