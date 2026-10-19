import { ProjectNameRegistry } from "src/core/support/project_name_registry";
import { SourceNames } from "src/core/source_names";
import { LintFileName } from "src/core/context/lint_file_name";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptLintSourceRecord } from "src/core/context/type_script_lint_source_record";
import { LintProjectContextStore } from "src/core/lint_project_context_store";
import { SourceText } from "src/source_text";
import type { LintProjectContextContract } from "src/protocols";
import type { LintSourceRecord } from "src/types";

describe("ProjectNameRegistry", () => {
	test("collects interface names without rescanning classes for every declaration", () => {
		const file = "/tmp/project-name-registry/module.ts";
		const text = [
			"class Service {}",
			"interface ServiceContract {}",
			"type ServiceOptions = { enabled: boolean };",
		].join("\n");
		const ast_file = new TypeScriptAstFile(file, text);
		const record: LintSourceRecord = new TypeScriptLintSourceRecord(
			{
				absolute_path: file,
				relative_path: "module.ts",
				file_name: new LintFileName("module.ts"),
				text,
				normalized_ast: ast_file.normalized(),
				source_resolver: new Map(),
			},
			ast_file,
			ast_file.traversal,
		);
		const context: LintProjectContextContract = new LintProjectContextStore(
			[record],
			{
				source_reads: 1,
				typescript_parses: 1,
				python_parses: 0,
				source_records: 1,
			},
			new SourceText(),
		);

		const registry = new ProjectNameRegistry({ project_files: [file], context }, new SourceNames());
		const names = registry.names("/tmp/project-name-registry");

		const interface_names = [...names.project_interface_names];
		interface_names.sort();
		expect(interface_names).toEqual(["ServiceContract", "ServiceOptions"]);
	});

	test("keeps the implementation class out of project interface names", () => {
		const file = "/tmp/project-name-registry/class.ts";
		const text = "class Service {}\ninterface ServiceContract {}\n";
		const ast_file = new TypeScriptAstFile(file, text);
		const record: LintSourceRecord = new TypeScriptLintSourceRecord(
			{
				absolute_path: file,
				relative_path: "class.ts",
				file_name: new LintFileName("class.ts"),
				text,
				normalized_ast: ast_file.normalized(),
				source_resolver: new Map(),
			},
			ast_file,
			ast_file.traversal,
		);
		const context: LintProjectContextContract = new LintProjectContextStore(
			[record],
			{
				source_reads: 1,
				typescript_parses: 1,
				python_parses: 0,
				source_records: 1,
			},
			new SourceText(),
		);
		const registry = new ProjectNameRegistry({ project_files: [file], context }, new SourceNames());
		const names = registry.names("/tmp/project-name-registry");

		expect([...names.project_interface_names]).toEqual(["ServiceContract"]);
	});
});
