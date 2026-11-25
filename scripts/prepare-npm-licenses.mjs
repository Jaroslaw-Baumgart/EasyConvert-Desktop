import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const native = JSON.parse(await readFile(path.join(root, "assets/licenses/sharp/manifest.json"), "utf8"));
const sharpPackage = JSON.parse(await readFile(path.join(root, "node_modules/sharp/package.json"), "utf8"));
if (sharpPackage.version !== native.sharp) throw new Error("Sharp changed: regenerate native license/source materials.");
if (process.platform === "win32" && process.arch === "x64") {
  const dll = await readFile(path.join(root, "node_modules/@img/sharp-win32-x64/lib/libvips-42.dll"));
  if (createHash("sha256").update(dll).digest("hex") !== native.nativeDllSha256) {
    throw new Error("libvips changed: review corresponding sources before packaging.");
  }
}
const fallbackMit = new Set(["brotli@1.3.3", "dfa@1.2.0", "fontkit@1.9.0", "@swc/helpers@0.3.17"]);
const mit = (await readFile(path.join(root, "LICENSE"), "utf8")).replace(/^Copyright.*\r?\n/m, "");
const sections = [];
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || entry.dev || !location.includes("node_modules/")) continue;
  const directory = path.join(root, location);
  let files;
  try { files = await readdir(directory); } catch (error) {
    if (error.code === "ENOENT" && entry.optional) continue;
    throw error;
  }
  const pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  const name = `${pkg.name}@${pkg.version}`;
  const notices = files.filter((file) => /^(licen[cs]e|copying|notice|copyright)([.-]|$)/i.test(file));
  const texts = await Promise.all(notices.sort().map(async (file) => `${file}\n${await readFile(path.join(directory, file), "utf8")}`));
  if (!notices.length) {
    if (!fallbackMit.has(name) || pkg.license !== "MIT") throw new Error(`Review missing license: ${name}`);
    // These releases declare MIT in package.json/README but omit a LICENSE file.
    // Preserve that declaration and author verbatim; do not invent copyright dates.
    texts.push(`Package license declaration: MIT\nAuthor: ${typeof pkg.author === "string" ? pkg.author : JSON.stringify(pkg.author)}\n\n${mit}`);
    const readme = files.find((file) => /^readme(\.|$)/i.test(file));
    if (readme) texts.push(await readFile(path.join(directory, readme), "utf8"));
  }
  sections.push(`${name}\nLicense: ${pkg.license ?? "See license text"}\n\n${texts.join("\n\n")}`);
}
// The JS Brotli decoder is derived from Google's Apache-2.0 code.
const brotli = path.join(root, "node_modules/brotli/dec");
for (const file of (await readdir(brotli)).filter((name) => name.endsWith(".js"))) {
  const source = await readFile(path.join(brotli, file), "utf8");
  const header = source.match(/^\s*\/\*[\s\S]*?\*\//)?.[0];
  if (header) sections.push(`brotli/dec/${file}\n${header}`);
}
sections.push(await readFile(path.join(root, "assets/licenses/Apache-2.0.txt"), "utf8"));
await mkdir(path.join(root, "tools/licenses"), { recursive: true });
await writeFile(path.join(root, "tools/licenses/NPM-LICENSES.txt"), sections.join("\n\n========================================\n\n"));
console.log(`Prepared ${sections.length} runtime license sections.`);
