import { LintFileName } from "src/core/context/lint_file_name";
import { LintProjectContextStore } from "src/core/lint_project_context_store";
import { ProjectNameRegistry } from "src/core/support/project_name_registry";
import { SourceText } from "src/io/source_text";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { ProjectNameRegistryPythonSource } from "tests/core/support/project_name_registry_python_source";

describe("ProjectNameRegistry", () => {
	test("collects interface names without rescanning classes for every declaration", () => {
		const file = "/tmp/project-name-registry/module.ts";
		const text = [
			"class Service {}",
			"interface ServiceContract {}",
			"type ServiceOptions = { enabled: boolean };",
		].join("\n");
		const ast_file = new TypeScriptAstFile(file, text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const record: LintSourceRecordData = {
			absolute_path: file,
			relative_path: "module.ts",
			file_name: new LintFileName("module.ts"),
			text,
			normalized_ast: ast_file.normalized(),
			language: "typescript",
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal,
		};
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

		const registry = new ProjectNameRegistry({
			repo_root: "/tmp/project-name-registry",
			project_files: [file],
			context,
		});
		const names = registry.names();

		const interface_names = [...names.project_interface_names];
		interface_names.sort();
		const source_records = context.files();
		expect({
			interface_names,
			stable_source_records: context.files() === source_records,
		}).toEqual({ interface_names: ["ServiceContract", "ServiceOptions"], stable_source_records: true });
	});

	test("keeps the implementation class out of project interface names", () => {
		const file = "/tmp/project-name-registry/class.ts";
		const text = "class Service {}\ninterface ServiceContract {}\n";
		const ast_file = new TypeScriptAstFile(file, text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const record: LintSourceRecordData = {
			absolute_path: file,
			relative_path: "class.ts",
			file_name: new LintFileName("class.ts"),
			text,
			normalized_ast: ast_file.normalized(),
			language: "typescript",
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal,
		};
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
		const registry = new ProjectNameRegistry({
			repo_root: "/tmp/project-name-registry",
			project_files: [file],
			context,
		});
		const names = registry.names();

		expect([...names.project_interface_names]).toEqual(["ServiceContract"]);
	});

	test("keeps Python enums in project types but not implementation class names", () => {
		const python_source = new ProjectNameRegistryPythonSource();
		const source = python_source.source();
		const context = new LintProjectContextStore(
			[source],
			{ source_reads: 1, typescript_parses: 0, python_parses: 1, source_records: 1 },
			new SourceText(),
		);
		const source_names = new ProjectNameRegistry({
			repo_root: "/tmp/project-name-registry",
			project_files: [source.absolute_path],
			context,
		});

		expect({
			class_names: source_names.names_for_source(source, false),
			type_names: source_names.names_for_source(source, true),
			class_names_include_contract: source_names.names_for_source(source, false).includes("ReaderContract"),
		}).toEqual({
			class_names: ["Service"],
			type_names: ["Status", "Mode", "RetryCount", "Service", "ReaderContract"],
			class_names_include_contract: false,
		});
		expect(source_names.names_for_source(source, true)).toContain("ReaderContract");
	});

	test("does not treat a sibling root with a shared path prefix as project source", () => {
		const file = "/tmp/project-name-registry-external/module.ts";
		const text = "export class ExternalType {}";
		const ast_file = new TypeScriptAstFile(file, text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const record: LintSourceRecordData = {
			absolute_path: file,
			relative_path: "module.ts",
			file_name: new LintFileName("module.ts"),
			text,
			normalized_ast: ast_file.normalized(),
			language: "typescript",
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal,
		};
		const context = new LintProjectContextStore(
			[record],
			{ source_reads: 1, typescript_parses: 1, python_parses: 0, source_records: 1 },
			new SourceText(),
		);
		const registry = new ProjectNameRegistry({
			repo_root: "/tmp/project-name-registry",
			project_files: [file],
			context,
		});

		expect([...registry.names().project_type_names]).toEqual([]);
	});
});
