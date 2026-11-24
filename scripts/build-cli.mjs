import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const project_root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
	absWorkingDir: project_root,
	entryPoints: [resolve(project_root, "src/core/cli.ts")],
	outfile: resolve(project_root, "dist/cli.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	external: ["typescript"],
	logLevel: "info",
});

await build({
	absWorkingDir: project_root,
	entryPoints: [resolve(project_root, "src/linting/orchestration/runtime/file_linting/typescript_worker/type_script_worker_entry.ts")],
	outfile: resolve(project_root, "dist/typescript_file_worker_entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	external: ["typescript"],
	logLevel: "info",
});
