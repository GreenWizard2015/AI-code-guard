import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";

/** Responsibilities: _analyzer source inventory_, _analysis identity seed_. **/
class InMemoryAnalyzerProject {
	public readonly root = "/virtual/analyzer";
	public readonly file_io: InMemoryFileIO;

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
		this.file_io = new InMemoryFileIO();
		const file_io = this.file_io;
		file_io.seed_files(files);
	}
}

describe("project analysis identity with in-memory IO", () => {
	test("changes analyzer identity when analyzer source changes", () => {
		const project = new InMemoryAnalyzerProject();
		const identity = new ProjectAnalysisIdentity(project.file_io, project.root);
		const previous = identity.analyzer();
		project.file_io.file_content.write_text(join(project.root, "src/analyzer.ts"), "export const version = 2;\n");
		const updated_identity = new ProjectAnalysisIdentity(project.file_io, project.root);
		const updated = updated_identity.analyzer();

		expect(updated).not.toBe(previous);
	});

	test("changes directory identity when a project directory is added", () => {
		const project = new InMemoryAnalyzerProject();
		const identity = new ProjectAnalysisIdentity(project.file_io, project.root);
		const previous = identity.directory_context(project.root);
		project.file_io.directory_operations.create_directory(join(project.root, "src/nested"));

		expect(identity.directory_context(project.root)).not.toBe(previous);
	});

	test("ignores generated directories when fingerprinting a project", () => {
		const project = new InMemoryAnalyzerProject();
		project.file_io.directory_operations.create_directory(join(project.root, "node_modules/package"));
		const identity = new ProjectAnalysisIdentity(project.file_io, project.root);
		const previous = identity.directory_context(project.root);
		project.file_io.directory_operations.create_directory(join(project.root, "node_modules/generated"));

		expect(identity.directory_context(project.root)).toBe(previous);
	});
});
