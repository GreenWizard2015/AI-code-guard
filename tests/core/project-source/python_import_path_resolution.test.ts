import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { PythonAbsoluteImportIndex } from "src/core/project-source/python-imports/python_absolute_import_index";
import { PythonImportFileIndex } from "src/core/project-source/python-imports/python_import_file_index";

describe("Python import path resolution", () => {
	test("selects a Python sibling rather than a TypeScript file", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/service.ts", "/project/service.py"]);

		expect(resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: ".service" })).toBe(
			"/project/service.py",
		);
	});

	test("resolves a parent-package import", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/package/service.py"]);

		expect(
			resolver.for_files(files).resolve_import({ importer: "/project/package/nested/main.py", specifier: "..service" }),
		).toBe("/project/package/service.py");
	});

	test("rejects a TypeScript-only candidate", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/service.ts"]);

		expect(resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: ".service" })).toBe("");
	});

	test("resolves absolute module names from the import root", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/service.py", "/project/a/service.py"]);

		expect(resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: "service" })).toBe(
			"/project/service.py",
		);
	});

	test("uses a project module before an external standard-library name", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/logging.py", "/project/main.py"]);

		expect({
			path: resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: "logging" }),
			project_import: resolver.for_files(files).project_import({ specifier: "logging" }),
		}).toEqual({ path: "/project/logging.py", project_import: true });
	});

	test("keeps a standard-library module external when only a nested source exists", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/src/io/project_file.py"]);

		expect({
			path: resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: "io" }),
			project_import: resolver.for_files(files).project_import({ specifier: "io" }),
		}).toEqual({ path: "", project_import: false });
	});

	test("does not infer an import root from an external importer directory", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/external/functions.py", "/external/consumer.py"]);

		expect(
			resolver.for_files(files).resolve_import({ importer: "/external/consumer.py", specifier: "functions" }),
		).toBe("");
	});

	test("reuses the absolute module index for the same root and file snapshot", () => {
		const index = new PythonImportFileIndex();
		const files = new Set(["/project/service.py"]);
		const root_index = index.for_root("/project", files);
		const first = root_index.absolute_import_index().imports();
		const second = root_index.absolute_import_index().imports();

		expect({
			same_root_index: index.for_root("/project", files) === root_index,
			same_module_index: first === second,
		}).toEqual({
			same_root_index: true,
			same_module_index: true,
		});
	});

	test("indexes files appended after the first lookup", () => {
		const files = ["/project/first.py"];
		const index = new PythonAbsoluteImportIndex("/project", files);
		const first = index.imports();
		files.push("/project/second.py");
		const second = index.imports();
		const modules = [...second.keys()];
		modules.sort();

		expect({
			same_index: first === second,
			modules,
		}).toEqual({
			same_index: true,
			modules: ["first.py", "second.py"],
		});
	});

	test("keeps outside and noncanonical paths on the existing relative-path semantics", () => {
		const index = new PythonAbsoluteImportIndex("/project", [
			"/project/main.py",
			"/project/nested/module.py",
			"/outside/module.py",
			"/project/../outside.py",
			"/projected/sibling.py",
		]);
		const modules = [...index.imports().keys()];
		modules.sort();

		expect(modules).toEqual(["main.py", "nested/module.py"]);
	});
});
