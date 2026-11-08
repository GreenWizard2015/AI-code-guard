import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { TestFixture } from "tests/core/test-fixture";

describe("Python package import resolution", () => {
	test("prefers package initializers independent of source order", () => {
		const module = "/project/widget.py";
		const initializer = "/project/widget/__init__.py";
		const resolver = new ProjectSourcePython("/project");
		const files = [module, initializer, "/project/main.py"];
		const reversed_files = [...files];
		reversed_files.reverse();
		const module_first = resolver
			.for_files(new Set(files))
			.resolve_import({ importer: "/project/main.py", specifier: "widget" });
		const package_first = resolver
			.for_files(new Set(reversed_files))
			.resolve_import({ importer: "/project/main.py", specifier: "widget" });
		const relative_module = resolver
			.for_files(new Set(files))
			.resolve_import({ importer: "/project/main.py", specifier: ".widget" });

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
		const violations = fixture.collect_fixture_violations(source_files);
		const resolver = new ProjectSourcePython("/project");
		const import_session = resolver.for_files(
			new Set(["/project/widget.py", "/project/widget/__init__.py", "/project/child.py"]),
		);
		const resolved_module = import_session.resolve_import({ importer: "/project/child.py", specifier: "widget" });

		expect(resolved_module).toBe("/project/widget/__init__.py");
		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id() }))).toContainEqual({
			file: "child.py",
			rule_id: "local-inheritance",
		});
	});

	test("preserves local inheritance when a project module shadows an external name", () => {
		const source_files = {
			"logging.py": "class LocalBase:\n    pass\n",
			"child.py": "from logging import LocalBase\nclass Child(LocalBase):\n    pass\n",
		};
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(source_files);
		const resolver = new ProjectSourcePython("/project");
		const import_session = resolver.for_files(new Set(["/project/logging.py", "/project/child.py"]));
		const resolved_module = import_session.resolve_import({ importer: "/project/child.py", specifier: "logging" });

		expect(resolved_module).toBe("/project/logging.py");
		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id() }))).toContainEqual({
			file: "child.py",
			rule_id: "local-inheritance",
		});
	});
});
