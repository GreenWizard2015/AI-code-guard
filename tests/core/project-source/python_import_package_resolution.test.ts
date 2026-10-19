import { resolve } from "node:path";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { TestFixture } from "tests/core/test-fixture";

describe("Python package import resolution", () => {
	test("prefers package initializers independent of source order", () => {
		const module = "/project/widget.py";
		const initializer = "/project/widget/__init__.py";
		const resolver = new ProjectSourcePython();
		const files = [module, initializer, "/project/main.py"];
		const reversed_files = [...files];
		reversed_files.reverse();
		const module_first = resolver.python_import_path("/project", "/project/main.py", "widget", new Set(files));
		const package_first = resolver.python_import_path(
			"/project",
			"/project/main.py",
			"widget",
			new Set(reversed_files),
		);
		const relative_module = resolver.python_import_path("/project", "/project/main.py", ".widget", new Set(files));

		expect({ module_first, package_first, relative_module }).toEqual({
			module_first: initializer,
			package_first: initializer,
			relative_module: initializer,
		});
	});

	test("preserves local inheritance through an initializer shadowing a module", () => {
		const source_files = {
			"widget.py": "class OtherBase:\n    pass\n",
			"widget/__init__.py": "class LocalBase:\n    pass\n",
			"child.py": "from widget import LocalBase\nclass Child(LocalBase):\n    pass\n",
		};
		const fixture = new TestFixture();
		const project = fixture.source_scanner_fixture(source_files);
		const violations = fixture.collect_fixture_violations(source_files);
		const resolver = new ProjectSourcePython();
		const imported_module = resolver.python_import_path(
			project.root,
			resolve(project.root, "child.py"),
			"widget",
			new Set(project.files),
		);

		expect({ imported_module, violations }).toEqual({
			imported_module: resolve(project.root, "widget/__init__.py"),
			violations: expect.arrayContaining([expect.objectContaining({ file: "child.py", rule_id: "local-inheritance" })]),
		});
	});

	test("preserves local inheritance when a project module shadows an external name", () => {
		const source_files = {
			"logging.py": "class LocalBase:\n    pass\n",
			"child.py": "from logging import LocalBase\nclass Child(LocalBase):\n    pass\n",
		};
		const fixture = new TestFixture();
		const project = fixture.source_scanner_fixture(source_files);
		const violations = fixture.collect_fixture_violations(source_files);
		const resolver = new ProjectSourcePython();
		const imported_module = resolver.python_import_path(
			project.root,
			resolve(project.root, "child.py"),
			"logging",
			new Set(project.files),
		);

		expect({ imported_module, violations }).toEqual({
			imported_module: resolve(project.root, "logging.py"),
			violations: expect.arrayContaining([expect.objectContaining({ file: "child.py", rule_id: "local-inheritance" })]),
		});
	});
});
