import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import type { UnusedSymbolDefinition } from "src/core/types";
import { TypeScriptReexportGraph } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport/type_script_reexport_graph";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintSourceRecordData } from "src/source_types";
import { ImportedSourceScanner } from "tests/bridge/ts/core/unused_symbol_import_scanner_fixture";

/** Responsibilities: _module path routing_, _source record creation_, _definition fixture creation_. **/
export class TypeScriptReexportTestFixture extends ImportedSourceScanner {
	private readonly _routes: ReadonlyMap<string, string>;
	private readonly _ast_model: AstModel;

	/** Responsibilities: _re-export fixture initialization_. **/
	public constructor(routes: ReadonlyMap<string, string>) {
		super([], "");
		this._routes = routes;
		this._ast_model = new AstModel("typescript");
	}

	/** Responsibilities: _import path resolution_. **/
	public override resolved_import_path(file: string, specifier: string, available: Set<string>): string {
		const fallback = super.resolved_import_path(file, specifier, available);
		return this._routes.get(`${file}\u0000${specifier}`) ?? fallback;
	}

	/** Responsibilities: _TypeScript source record creation_. **/
	public source_record(file: string, text: string): LintSourceRecordData {
		const typescript_ast = new TypeScriptAstFile(file, text);
		return {
			absolute_path: file,
			relative_path: file,
			file_name: new LintFileName(file),
			text,
			normalized_ast: this._ast_model.empty_ast_file(),
			language: "typescript",
			typescript_ast,
			source_resolver: new Map(),
			traversal: new TypeScriptAstTraversal(typescript_ast.source_file_node()),
		};
	}

	/** Responsibilities: _TypeScript source fixture collection_. **/
	public source_records(entries: ReadonlyMap<string, string>): Map<string, LintSourceRecordData> {
		const sources = new Map<string, LintSourceRecordData>();
		for (const [file, text] of entries.entries()) {
			sources.set(file, this.source_record(file, text));
		}
		return sources;
	}

	/** Responsibilities: _TypeScript type definition fixture_. **/
	public type_definition(file: string, name: string): UnusedSymbolDefinition {
		return {
			file,
			line: 1,
			name,
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		};
	}

	/** Responsibilities: _TypeScript re-export definition fixture_. **/
	public type_definitions(file: string, names: readonly string[]): UnusedSymbolDefinition[] {
		return names.map((name) => this.type_definition(file, name));
	}

	/** Responsibilities: _barrel usage fixture_. **/
	public type_usage_case(): {
		sources: Map<string, LintSourceRecordData>;
		definition: UnusedSymbolDefinition;
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
	} {
		const importer = "/project/consumer.ts";
		const barrel = "/project/barrel.ts";
		const definition_file = "/project/definition.ts";
		const base = this.source_record(importer, 'import type { Shape } from "./barrel";');
		const consumer = {
			...base,
			normalized_ast: {
				...base.normalized_ast,
				references: { ...base.normalized_ast.references, symbol_references: [{ name: "Shape", line: 0 }] },
			},
		};
		const sources = new Map<string, LintSourceRecordData>([[importer, consumer]]);
		sources.set(barrel, this.source_record(barrel, 'export * from "./definition";'));
		sources.set(definition_file, this.source_record(definition_file, "export type Shape = string;"));
		const definition = this.type_definition(definition_file, "Shape");
		return { sources, definition, definitions_by_file: new Map([[definition_file, [definition]]]) };
	}

	/** Responsibilities: _re-export graph fixture creation_. **/
	public reexport_graph(
		sources: Map<string, LintSourceRecordData>,
		definitions: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
		available_files: Set<string>,
	): TypeScriptReexportGraph {
		return new TypeScriptReexportGraph(this, available_files, sources, definitions);
	}
}
