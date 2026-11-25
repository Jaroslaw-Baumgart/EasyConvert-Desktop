import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

if (process.platform !== "win32") throw new Error("This tool prepares Windows x64 binaries.");

const root = fileURLToPath(new URL("../", import.meta.url));
const lockBytes = await readFile(new URL("./poppler-win64.lock.json", import.meta.url));
const lock = JSON.parse(lockBytes);
const cache = path.join(root, "tools/downloads");
const prefix = path.join(cache, "poppler-env");
const output = path.join(root, "tools/poppler");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function download(urls, sha256, destination) {
  if (existsSync(destination) && hash(await readFile(destination)) === sha256) return;
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes) !== sha256) throw new Error("SHA256 mismatch");
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
      return;
    } catch (error) {
      console.error(`${url}: ${error.message}`);
    }
  }
  throw new Error(`Could not download verified file: ${destination}`);
}

await mkdir(cache, { recursive: true });
const mamba = path.join(cache, "micromamba.exe");
await download([lock.bootstrap.url], lock.bootstrap.sha256, mamba);
const explicit = path.join(cache, "poppler-explicit.txt");
await writeFile(explicit, "@EXPLICIT\n" + lock.packages.map(p => `${p.url}#${p.sha256}`).join("\n") + "\n");
async function installedPackages() {
  const directory = path.join(prefix, "conda-meta");
  if (!existsSync(directory)) return [];
  return Promise.all((await readdir(directory)).filter(file => file.endsWith(".json"))
    .map(async file => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}
let records = await installedPackages();
if (!lock.packages.every(p => records.some(r => r.name === p.name && r.sha256 === p.sha256))) {
  execFileSync(mamba, ["create", "--no-rc", "--root-prefix", path.join(cache, "mamba"),
    "--prefix", prefix, "--file", explicit, "--yes"], { stdio: "inherit" });
  records = await installedPackages();
}

await mkdir(output, { recursive: true });
for (const directory of ["bin", "share", "etc"]) {
  const source = path.join(prefix, "Library", directory);
  if (existsSync(source)) await cp(source, path.join(output, directory), {
    recursive: true,
    filter: file => !file.endsWith(".exe") || ["pdfinfo.exe", "pdftocairo.exe", "pdftotext.exe"].includes(path.basename(file)),
  });
}
if (existsSync(path.join(prefix, "share"))) {
  await cp(path.join(prefix, "share"), path.join(output, "share"), { recursive: true });
}

for (const pkg of lock.packages) {
  const record = records.find(r => r.name === pkg.name && r.sha256 === pkg.sha256);
  if (!record) throw new Error(`Installed package does not match lock: ${pkg.name}`);
  const info = path.join(record.extracted_package_dir, "info");
  const target = path.join(output, "third-party", `${pkg.name}-${pkg.version}`);
  for (const directory of ["licenses", "recipe"]) {
    const source = path.join(info, directory);
    if (existsSync(source)) await cp(source, path.join(target, directory), { recursive: true });
  }
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
}

// The freetype runtime split packages omit their parent project's license files.
const freetype = lock.packages.find(p => p.name === "libfreetype6");
const source = freetype.sources[0];
const freetypeArchive = path.join(cache, `freetype-${freetype.version}.tar.gz`);
await download(source.urls, source.sha256, freetypeArchive);
for (const pkg of lock.packages.filter(p => p.name.startsWith("libfreetype"))) {
  const target = path.join(output, "third-party", `${pkg.name}-${pkg.version}`, "licenses");
  await mkdir(target, { recursive: true });
  for (const name of ["FTL.TXT", "GPLv2.TXT"]) {
    const text = execFileSync("tar", ["-xOf", freetypeArchive, `freetype-${freetype.version}/docs/${name}`]);
    await writeFile(path.join(target, name), text);
  }
}
await writeFile(path.join(output, "manifest.json"), lockBytes);
console.log(`Prepared Poppler ${lock.version}, including dependency licenses and build recipes.`);

if (process.argv.includes("--sources")) {
  const entries = { "manifest.json": new Uint8Array(lockBytes) };
  for (const pkg of lock.packages) {
    for (const [index, source] of pkg.sources.entries()) {
      // Microsoft runtime installers are redistributables, not source archives.
      if (pkg.license.startsWith("LicenseRef-Microsoft")) continue;
      if (!source.urls.length || !source.sha256) throw new Error(`Missing source metadata: ${pkg.name}`);
      const name = new URL(source.urls[0]).pathname.split("/").pop();
      console.log(`Source: ${pkg.name} (${name})`);
      const archive = path.join(cache, "sources", source.sha256, name);
      await download(source.urls, source.sha256, archive);
      entries[`sources/${pkg.name}/${index}-${name}`] = new Uint8Array(await readFile(archive));
    }
    const recipe = path.join(output, "third-party", `${pkg.name}-${pkg.version}`);
    for (const name of await readdir(recipe, { recursive: true, withFileTypes: true })) {
      if (!name.isFile()) continue;
      const parent = name.parentPath ?? name.path;
      const relative = path.relative(recipe, path.join(parent, name.name)).replaceAll("\\", "/");
      entries[`recipes/${pkg.name}/${relative}`] = new Uint8Array(await readFile(path.join(parent, name.name)));
    }
  }
  await mkdir(path.join(root, "release"), { recursive: true });
  const bundle = path.join(root, "release", `Poppler-sources-${lock.version}.zip`);
  await writeFile(bundle, zipSync(entries, { level: 0 }));
  console.log(`Source bundle: ${bundle}`);
}
