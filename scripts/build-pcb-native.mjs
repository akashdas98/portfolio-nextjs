import { build, context } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function createNativeBuild({ watch = false } = {}) {
  const options = {
    absWorkingDir: root,
    entryPoints: ["lib/pcb/native-entry.ts"],
    outfile: "public/_pcb/entry.js",
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    define: { __PCB_DEVELOPMENT__: String(watch) },
    plugins: [{ name: "publish-native-entry", setup(builder) {
      builder.onEnd(async (result) => {
        if (result.errors.length) return;
        const output = result.outputFiles[0];
        const hash = createHash("sha256").update(output.contents).digest("hex").slice(0, 20);
        const src = `/_pcb/entry-${hash}.js`;
        const manifest = `${JSON.stringify({ version: 1, src })}\n`;
        await mkdir(path.join(root, "public/_pcb"), { recursive: true });
        await writeFile(path.join(root, "public", src), output.contents);
        const manifestPath = path.join(root, "lib/pcb/native-entry-manifest.json");
        const previous = await readFile(manifestPath, "utf8").catch(() => "");
        if (previous !== manifest) {
          await writeFile(`${manifestPath}.tmp`, manifest);
          await rename(`${manifestPath}.tmp`, manifestPath);
        }
        if (watch) await writeFile(path.join(root, "public/_pcb/dev-version.json"), manifest);
      });
    } }],
  };
  if (watch) {
    const builder = await context(options);
    try {
      await builder.rebuild();
      await builder.watch();
      return builder;
    } catch (error) {
      await builder.dispose();
      throw error;
    }
  }
  return build(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await createNativeBuild();
}
