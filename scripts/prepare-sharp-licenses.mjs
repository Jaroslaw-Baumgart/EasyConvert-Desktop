import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(await readFile(new URL("./sharp-sources.lock.json", import.meta.url)));
const cache = path.join(root, "tools/downloads/sharp-sources");
const licenses = path.join(root, "assets/licenses/sharp");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const installed = JSON.parse(await readFile(path.join(root, "node_modules/@img/sharp-win32-x64/package.json")));
if (installed.version !== lock.sharp) throw new Error("Sharp version changed: review native license lock.");
if (hash(await readFile(path.join(root, "node_modules/@img/sharp-win32-x64/lib/libvips-42.dll"))) !== lock.nativeDllSha256) {
  throw new Error("Native library changed: review corresponding source manifest.");
}
await mkdir(cache, { recursive: true });
await mkdir(licenses, { recursive: true });
const previousManifest = existsSync(path.join(licenses, "manifest.json"))
  ? JSON.parse(await readFile(path.join(licenses, "manifest.json"), "utf8")) : null;

async function download(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

// Hashes come from upstream recipes, with documented mirror/notice exceptions.
for (const source of lock.sources) {
  const file = path.join(cache, `${source.name}-${path.basename(new URL(source.url).pathname)}`);
  if (!existsSync(file) || hash(await readFile(file)) !== source.sha256) {
    const bytes = await download(source.url);
    if (hash(bytes) !== source.sha256) throw new Error(`${source.name}: source checksum mismatch`);
    await writeFile(file, bytes);
  }
  if (existsSync(path.join(licenses, `${source.name}.txt`)) &&
    previousManifest?.sources.find((entry) => entry.name === source.name)?.sha256 === source.sha256) {
    console.log(`${source.name}: cached source verified`);
    continue;
  }
  const names = execFileSync("tar", ["-tf", file], { maxBuffer: 32 * 1024 * 1024 }).toString().split(/\r?\n/);
  const selected = names.filter((name) => !name.endsWith("/") &&
    /^(licen[cs]e|copying|notice|copyright|ftl\.txt)([._-]|$)/i.test(path.posix.basename(name)));
  if (!selected.length) throw new Error(`${source.name}: no license files found`);
  const sections = selected.map((name) => `${name}\n\n${execFileSync("tar", ["-xOf", file, name], {
    maxBuffer: 16 * 1024 * 1024,
  }).toString()}`);
  await writeFile(path.join(licenses, `${source.name}.txt`), sections.join("\n\n========================================\n\n"));
  console.log(`${source.name}: source verified, ${selected.length} license files`);
}

// Preserve the complete recipes and patches, not only source download links.
for (const { name, repository, commit, sha256 } of lock.snapshots) {
  const file = path.join(cache, `${name}-${commit}.tar.gz`);
  if (!existsSync(file) || hash(await readFile(file)) !== sha256) {
    const bytes = await download(`https://codeload.github.com/${repository}/tar.gz/${commit}`);
    if (hash(bytes) !== sha256) throw new Error(`${name}: build snapshot checksum mismatch`);
    await writeFile(file, bytes);
  }
}

// librsvg's Rust dependencies are pinned by its published Cargo.lock.
const rustNotices = [];
const mitText = (await readFile(path.join(root, "LICENSE"), "utf8")).replace(/^Copyright.*\r?\n/m, "");
const mplText = await readFile(path.join(licenses, "MPL-2.0.txt"), "utf8");
const pending = [...lock.rustCrates];
let completed = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (pending.length) {
    const crate = pending.shift();
    const name = `${crate.name}-${crate.version}`;
    const file = path.join(cache, `${name}.crate`);
    if (!existsSync(file) || hash(await readFile(file)) !== crate.sha256) {
      const bytes = await download(`https://static.crates.io/crates/${crate.name}/${name}.crate`);
      if (hash(bytes) !== crate.sha256) throw new Error(`${name}: Rust source checksum mismatch`);
      await writeFile(file, bytes);
    }
    const files = execFileSync("tar", ["-tf", file]).toString().split(/\r?\n/).filter((entry) =>
      !entry.endsWith("/") && /^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(path.posix.basename(entry)));
    const metadata = execFileSync("tar", ["-xOf", file, `${name}/Cargo.toml`]).toString();
    const declared = metadata.match(/^license\s*=\s*"([^"]+)"/m)?.[1];
    const mitOption = declared?.split(" OR ").includes("MIT") && !declared.includes(" AND ");
    if (!files.length && !mitOption && !["MIT/Apache-2.0", "Apache-2.0/MIT", "MPL-2.0"].includes(declared)) {
      throw new Error(`${name}: missing Rust license text (${declared}); review required`);
    }
    const notice = files.length ? files.map((entry) => `${entry}\n${execFileSync("tar", ["-xOf", file, entry], {
      maxBuffer: 16 * 1024 * 1024,
    }).toString()}`).join("\n\n") : `License declaration and authors from the original Cargo.toml:\n${metadata}\n${declared === "MPL-2.0" ? mplText : `MIT option:\n${mitText}`}`;
    rustNotices.push({ name, notice });
    if (++completed % 25 === 0) console.log(`Rust source/license files verified: ${completed}/${lock.rustCrates.length}`);
  }
}));
await writeFile(path.join(licenses, "rust-dependencies.txt"), rustNotices.sort((a, b) => a.name.localeCompare(b.name))
  .map(({ name, notice }) => `${name}\n${notice}`).join("\n\n========================================\n\n"));
await writeFile(path.join(licenses, "manifest.json"), JSON.stringify(lock, null, 2) + "\n");
if (process.argv.includes("--sources")) {
  const entries = {};
  const inputs = [
    ...lock.sources.map((source) => `${source.name}-${path.basename(new URL(source.url).pathname)}`),
    ...lock.snapshots.map(({ name, commit }) => `${name}-${commit}.tar.gz`),
    ...lock.rustCrates.map(({ name, version }) => `${name}-${version}.crate`),
  ];
  for (const name of inputs) entries[`sources/${name}`] = await readFile(path.join(cache, name));
  entries["manifest.json"] = Buffer.from(JSON.stringify(lock, null, 2));
  entries["README.txt"] = await readFile(path.join(licenses, "README.txt"));
  for (const name of await readdir(licenses)) entries[`licenses/${name}`] = await readFile(path.join(licenses, name));
  await mkdir(path.join(root, "release"), { recursive: true });
  await writeFile(path.join(root, `release/Sharp-libvips-sources-${lock.vips}.zip`), zipSync(entries, { level: 0 }));
  console.log("Source bundle ready.");
}
