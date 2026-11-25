import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

// Use the modules in output chunks, including chunks created for workers.
export function licenseNotices(roots = new Set<string>(), collectOnly = false): Plugin {
  return {
    name: "third-party-licenses",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of Object.keys(output.modules)) {
          const normalized = id.replaceAll("\0", "").replaceAll("\\", "/");
          const marker = normalized.lastIndexOf("/node_modules/");
          if (marker < 0) continue;
          const parts = normalized.slice(marker + 14).split("/");
          const name = parts.slice(0, parts[0].startsWith("@") ? 2 : 1).join("/");
          roots.add(`${normalized.slice(0, marker + 14)}${name}`);
        }
      }
      if (collectOnly) return;
      // JSZip's browser entry is prebundled, so Rollup cannot see its embedded
      // dependencies as individual modules. Preserve their notices as well.
      const addEmbedded = (root: string) => {
        const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
        const require = createRequire(`${root}/package.json`);
        for (const name of Object.keys(pkg.dependencies ?? {})) {
          const packageFile = require.resolve(`${name}/package.json`).replaceAll("\\", "/");
          const dependency = packageFile.slice(0, -13);
          if (roots.has(dependency)) continue;
          roots.add(dependency);
          addEmbedded(dependency);
        }
      };
      for (const root of [...roots]) {
        if (root.endsWith("/jszip")) addEmbedded(root);
      }
      const notices = [...roots].sort().map((root) => {
        const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
        const files = readdirSync(root).filter((name) =>
          /^(licen[cs]e|copying|notice|copyright)([.-]|$)/i.test(name),
        );
        if (!files.length) {
          const readme = readdirSync(root).find((name) => /^readme(\.|$)/i.test(name));
          if (readme && readFileSync(`${root}/${readme}`, "utf8").includes("Permission is hereby granted")) {
            files.push(readme);
          } else this.error(`Missing license text: ${pkg.name}@${pkg.version}`);
        }
        return `${pkg.name}@${pkg.version}\nLicense: ${pkg.license}\n\n${files
          .sort()
          .map((name) => `${name}\n${readFileSync(`${root}/${name}`, "utf8")}`)
          .join("\n\n")}`;
      });
      this.emitFile({
        type: "asset",
        fileName: "THIRD-PARTY-LICENSES.txt",
        source: notices.join("\n\n========================================\n\n"),
      });
    },
  };
}
