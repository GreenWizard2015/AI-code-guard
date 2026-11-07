import { ProjectSourcePython } from "src/core/project-source/project_source_python";

describe("Python namespace import resolution", () => {
	test("recognizes namespace roots without nested suffix false matches", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/tools/webmcp/module.py", "/project/other/service.py"]);

		expect(resolver.for_files(files).project_import({ specifier: "tools.webmcp" })).toBe(true);
		expect(resolver.for_files(files).project_import({ specifier: "missing.webmcp" })).toBe(false);
	});

	test("resolves modules below a src namespace package", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/src/mcp_proxy/constants.py", "/project/src/mcp_proxy/tasks/task.py"]);

		expect(
			resolver
				.for_files(files)
				.resolve_import({ importer: "/project/src/mcp_proxy/tasks/task.py", specifier: "mcp_proxy.constants" }),
		).toBe("/project/src/mcp_proxy/constants.py");
	});

	test("discovers an implicit namespace root beside top-level Python modules", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set([
			"/project/src/python-bridge/python_bridge_entrypoint.py",
			"/project/src/python-bridge/implementation/protocols.py",
			"/project/src/python-bridge/implementation/ast/tree.py",
		]);

		expect(
			resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: "implementation.ast.tree" }),
		).toBe("/project/src/python-bridge/implementation/ast/tree.py");
	});

	test("discovers a namespace root across a directory without direct Python files", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set([
			"/project/src/python-bridge/python_bridge_entrypoint.py",
			"/project/src/python-bridge/implementation/ast/tree.py",
			"/project/src/python-bridge/implementation/ast/callables/dependencies.py",
			"/project/main.py",
		]);

		expect(
			resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: "implementation.ast.tree" }),
		).toBe("/project/src/python-bridge/implementation/ast/tree.py");
	});

	test("rejects unrelated nested directories as import roots", () => {
		const resolver = new ProjectSourcePython("/project");
		const files = new Set(["/project/vendor/email/message.py", "/project/main.py"]);

		expect(resolver.for_files(files).resolve_import({ importer: "/project/main.py", specifier: "email.message" })).toBe(
			"",
		);
	});

	test("resolves repeated namespace lookups in a large project inventory", () => {
		const files = new Set<string>();
		for (let index = 0; index < 100; index += 1) {
			files.add(`/project/src/package_${index}/module.py`);
		}
		const resolver = new ProjectSourcePython("/project");

		const imports = resolver.for_files(files);
		const first = imports.resolve_import({ importer: "/project/main.py", specifier: "src.package_99.module" });
		const repeated = imports.resolve_import({ importer: "/project/main.py", specifier: "src.package_99.module" });

		expect({ first, repeated }).toEqual({
			first: "/project/src/package_99/module.py",
			repeated: "/project/src/package_99/module.py",
		});
	});

	test("preserves importer-directory fallback across a large project inventory", () => {
		const files = new Set<string>();
		for (let index = 0; index < 100; index += 1) {
			files.add(`/project/package_${index}/main.py`);
		}
		const resolver = new ProjectSourcePython("/project");
		const resolved = new Set<string>();
		for (let index = 0; index < 100; index += 1) {
			resolved.add(
				resolver
					.for_files(files)
					.resolve_import({ importer: `/project/package_${index}/main.py`, specifier: "missing_module" }),
			);
		}

		expect(resolved).toEqual(new Set([""]));
	});
});
