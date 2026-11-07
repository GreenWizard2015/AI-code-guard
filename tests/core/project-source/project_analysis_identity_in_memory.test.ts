import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryAnalyzerProject } from "tests/core/project-source/in-memory-analyzer-project";

describe("project analysis identity with in-memory IOContract", () => {
	test("changes analyzer identity when selected Python runtime content changes", () => {
		const project = new InMemoryAnalyzerProject();
		const runtime_directory = join(project.root, "runtime");
		const runtime = join(runtime_directory, "python3");
		project._file_io.create_directory(runtime_directory);
		project._file_io.file(runtime).write_text("python runtime one");
		const previous_identity = new ProjectAnalysisIdentity(project._file_io, project.root, runtime_directory);
		const previous = previous_identity.analyzer();
		project._file_io.file(runtime).write_text("python runtime two");
		const updated_identity = new ProjectAnalysisIdentity(project._file_io, project.root, runtime_directory);
		const updated = updated_identity.analyzer();

		expect(updated).not.toBe(previous);
	});

	test("changes analyzer identity when the selected Python runtime path changes", () => {
		const project = new InMemoryAnalyzerProject();
		project.seed_runtimes();
		const first_analysis = new ProjectAnalysisIdentity(
			project._file_io,
			project.root,
			join(project.root, "runtime-one"),
		);
		const first_identity = first_analysis.analyzer();
		const second_analysis = new ProjectAnalysisIdentity(
			project._file_io,
			project.root,
			join(project.root, "runtime-two"),
		);
		const second_identity = second_analysis.analyzer();

		expect(second_identity).not.toBe(first_identity);
	});

	test("changes analyzer identity when analyzer source changes", () => {
		const project = new InMemoryAnalyzerProject();
		const identity = new ProjectAnalysisIdentity(project._file_io, project.root);
		const previous = identity.analyzer();
		project._file_io.file(join(project.root, "src/analyzer.ts")).write_text("export const version = 2;\n");
		const updated_identity = new ProjectAnalysisIdentity(project._file_io, project.root);
		const updated = updated_identity.analyzer();

		expect(updated).not.toBe(previous);
	});

	test("changes directory identity when a project directory is added", () => {
		const project = new InMemoryAnalyzerProject();
		const identity = new ProjectAnalysisIdentity(project._file_io, project.root);
		const previous = identity.directory_context(project.root);
		project._file_io.create_directory(join(project.root, "src/nested"));

		expect(identity.directory_context(project.root)).not.toBe(previous);
	});

	test("ignores generated directories when fingerprinting a project", () => {
		const project = new InMemoryAnalyzerProject();
		project._file_io.create_directory(join(project.root, "node_modules/package"));
		const identity = new ProjectAnalysisIdentity(project._file_io, project.root);
		const previous = identity.directory_context(project.root);
		project._file_io.create_directory(join(project.root, "node_modules/generated"));

		expect(identity.directory_context(project.root)).toBe(previous);
	});
});
