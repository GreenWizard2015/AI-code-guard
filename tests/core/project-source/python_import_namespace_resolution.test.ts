import { ProjectSourcePython } from "src/core/project-source/project_source_python";

describe("Python namespace import resolution", () => {
	test("recognizes namespace roots without nested suffix false matches", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/tools/webmcp/module.py", "/project/other/service.py"]);

		expect(resolver.python_import("/project", "tools.webmcp", files)).toBe(true);
		expect(resolver.python_import("/project", "missing.webmcp", files)).toBe(false);
	});

	test("resolves modules below a src namespace package", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/src/mcp_proxy/constants.py", "/project/src/mcp_proxy/tasks/task.py"]);

		expect(
			resolver.python_import_path("/project", "/project/src/mcp_proxy/tasks/task.py", "mcp_proxy.constants", files),
		).toBe("/project/src/mcp_proxy/constants.py");
	});

	test("rejects unrelated nested directories as import roots", () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(["/project/vendor/email/message.py", "/project/main.py"]);

		expect(resolver.python_import_path("/project", "/project/main.py", "email.message", files)).toBe("");
	});

	test("indexes namespace directories once for repeated lookup", () => {
		const files = new Set<string>();
		for (let index = 0; index < 100; index += 1) {
			files.add(`/project/src/package_${index}/module.py`);
		}
		let iterations = 0;
		files[Symbol.iterator] = (): SetIterator<string> => {
			iterations += 1;
			return files.values();
		};
		const resolver = new ProjectSourcePython();

		expect(resolver.python_import_path("/project", "/project/main.py", "src.package_99.module", files)).toBe(
			"/project/src/package_99/module.py",
		);
		expect(iterations).toBeLessThanOrEqual(3);
	});

	test("does not rebuild the project index for importer-directory fallbacks", () => {
		const files = new Set<string>();
		for (let index = 0; index < 100; index += 1) {
			files.add(`/project/package_${index}/main.py`);
		}
		let iterations = 0;
		files[Symbol.iterator] = (): SetIterator<string> => {
			iterations += 1;
			return files.values();
		};
		const resolver = new ProjectSourcePython();
		const resolved = new Set<string>();
		for (let index = 0; index < 100; index += 1) {
			resolved.add(
				resolver.python_import_path("/project", `/project/package_${index}/main.py`, "missing_module", files),
			);
		}

		expect(resolved).toEqual(new Set([""]));
		expect(iterations).toBeLessThanOrEqual(2);
	});
});
