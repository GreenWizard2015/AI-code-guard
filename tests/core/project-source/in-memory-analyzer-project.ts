import { join } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _analyzer source inventory_, _analysis identity seed_. **/
export class InMemoryAnalyzerProject {
	public readonly root = "/virtual/analyzer";
	public readonly _file_io: InMemoryFileIO;

	/** Responsibilities: _analyzer source inventory_. **/
	public constructor() {
		const files = new Map<string, string>([
			[join(this.root, "src/analyzer.ts"), "export const version = 1;\n"],
			[join(this.root, "docs/rules/example.md"), "Rule documentation.\n"],
			[join(this.root, "test-runner/runner.ts"), "export const runner = true;\n"],
			[join(this.root, "package.json"), "{}\n"],
			[join(this.root, "requirements.txt"), "\n"],
			[join(this.root, "tsconfig.json"), "{}\n"],
		]);
		this._file_io = new InMemoryFileIO();
		this._file_io.seed_files(files);
	}

	/** Responsibilities: _runtime fixture preparation_. **/
	public seed_runtimes(): void {
		for (const directory_name of ["runtime-one", "runtime-two"]) {
			const runtime_directory = join(this.root, directory_name);
			this._file_io.create_directory(runtime_directory);
			this._file_io.file(join(runtime_directory, "python3")).write_text("python runtime");
		}
	}
}
