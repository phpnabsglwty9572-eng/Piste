import { mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "hot-update");
mkdirSync(join(out, "rn"), { recursive: true });
mkdirSync(join(out, "h5"), { recursive: true });
cpSync(join(root, "rn", "web"), join(out, "rn"), { recursive: true });
cpSync(join(root, "h5"), join(out, "h5"), { recursive: true });

const version = Date.now();
for (const layer of ["rn", "h5"]) {
  const manifestPath = join(out, layer, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

console.log("Packed dist/hot-update. Upload rn/ and h5/ to the hot-update bucket, then insert a published hot_releases row.");
console.log("Do not put the service role key in this repo. Use the dashboard or a local env var.");
