import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const python =
  process.env.PYTHON || (process.platform === "win32" ? "py" : "python3");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Recreate the entire deployable directory; never rely on an earlier build.
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });
cpSync(
  new URL("../public/", import.meta.url),
  new URL("../dist/", import.meta.url),
  {
    recursive: true,
  },
);
mkdirSync(new URL("../dist/assets/", import.meta.url), { recursive: true });

run(python, ["tools/extract.py"]);
for (const name of [
  "tracks",
  "tim",
  "models",
  "audio",
  "music",
  "hud",
  "background",
  "help",
  "card",
]) {
  // Help text and staff text are checked-in TypeScript data. Only regenerate
  // runtime assets here, so building never rewrites the source tree.
  run(python, [
    `tools/convert_${name}.py`,
    ...(name === "help" ? ["--assets-only"] : []),
  ]);
}
run(process.execPath, ["node_modules/typescript/bin/tsc"]);
