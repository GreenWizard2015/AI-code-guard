import { LintFileName } from "src/core/context/lint_file_name";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { TypeScriptScannerOptions } from "src/model_types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";

/** Responsibilities: _imported interface identity_, _project type boundary analysis_. **/
export class ImportedTypeIdentityScenario {
	private readonly _files: ReadonlyMap<string, TypeScriptAstFile>;
	private readonly _options: TypeScriptScannerOptions;

	/** Responsibilities: _source graph initialization_. **/
	public constructor() {
		const port_file = "/project/port.ts";
		const use_file = "/project/use.ts";
		const other_file = "/project/other.ts";
		const port_text = "export interface Item { value: number; }";
		const use_text =
			"import type { Item } from './port'; export function use(value: Item): number { return value.value; }";
		const other_text = "export class Item { public value = 1; }";
		const use_ast = new TypeScriptAstFile(use_file, use_text);
		const files = new Map<string, TypeScriptAstFile>([
			[port_file, new TypeScriptAstFile(port_file, port_text)],
			[use_file, use_ast],
			[other_file, new TypeScriptAstFile(other_file, other_text)],
		]);
		this._files = files;
		const file_entries = [...files];
		const source_nodes = file_entries.map(([file, ast_file]) => [file, ast_file.source_file_node()] as const);
		const source_files = new Map(source_nodes);
		const module_context = new TypeScriptModuleExportsContext(
			"/project",
			source_files,
			false,
			new InMemoryProjectSourceIO(new Map()),
		);
		this._options = {
			source: {
				file_name: new LintFileName(use_file),
				text: use_text,
				ast_file: use_ast,
				traversal: new TypeScriptAstTraversal(use_ast.source_file_node()),
				stage_timer: new LintStageTimer(),
			},
			names: {
				project_class_names: new Set(["Item"]),
				typescript_class_names: new Set(["Item"]),
				project_interface_names: new Set(["Item"]),
				project_type_names: new Set(["Item"]),
				project_alias_names: new Set(),
				project_contract_names: new Set(["Item"]),
				project_boundary_types: new Set(["Item"]),
				project_boundary_contracts: new Set<string>(),
			},
			project_name_inventory: new Set(["Item"]),
			module_scope: {
				module_resolver: module_context.module_exports(),
				project_files: new Set(files.keys()),
			},
		};
	}

	/** Responsibilities: _project source paths_. **/
	public source_files(): readonly string[] {
		return [...this._files.keys()];
	}

	/** Responsibilities: _scanner option assembly_. **/
	public scanner_options(): TypeScriptScannerOptions {
		return this._options;
	}
}
