import { ProjectSourcePython } from "src/core/project-source/project_source_python";

describe("Python import path resolution", () => {
	test("selects a Python sibling rather than a TypeScript file", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/service.ts", "/project/service.py"]);

		expect(resolver.python_import_path("/project", "/project/main.py", ".service", files)).toBe("/project/service.py");
	});

	test("rejects a TypeScript-only candidate", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/service.ts"]);

		expect(resolver.python_import_path("/project", "/project/main.py", ".service", files)).toBe("");
	});

	test("resolves absolute module names from the import root", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/service.py", "/project/a/service.py"]);

		expect(resolver.python_import_path("/project", "/project/main.py", "service", files)).toBe("/project/service.py");
	});

	test("uses a project module before an external standard-library name", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/logging.py", "/project/main.py"]);

		expect({
			path: resolver.python_import_path("/project", "/project/main.py", "logging", files),
			project_import: resolver.python_import("/project", "logging", files),
		}).toEqual({ path: "/project/logging.py", project_import: true });
	});

	test("keeps a standard-library module external when only a nested source exists", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/src/io/project_file.py"]);

		expect({
			path: resolver.python_import_path("/project", "/project/main.py", "io", files),
			project_import: resolver.python_import("/project", "io", files),
		}).toEqual({ path: "", project_import: false });
	});

	test("does not infer an import root from an external importer directory", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/external/functions.py", "/external/consumer.py"]);

		expect(resolver.python_import_path("/project", "/external/consumer.py", "functions", files)).toBe("");
	});
});
