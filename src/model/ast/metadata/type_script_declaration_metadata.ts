import { TYPESCRIPT_TREE_METADATA_FLAGS } from "src/constants";
import { TypeScriptDeclarationNameIndex } from "src/model/ast/declarations/type_script_declaration_name_index";
import { TypeScriptImportSymbolDeclaration } from "src/model/ast/declarations/type_script_import_symbol_declaration";
import { TypeScriptSymbolDeclaration } from "src/model/ast/declarations/type_script_symbol_declaration";
import type { TypeScriptNodeImportIssuesContract } from "src/model/protocols";
import type { TreeMetadataState } from "src/model/types";
import { TypeScriptTypeDeclarations } from "src/parser/type_script_type_declarations";
import type ts from "typescript";

/** Responsibilities: _declaration metadata_, _type metadata_. **/
export class TypeScriptDeclarationMetadata {
	private readonly _declaration_names: TypeScriptDeclarationNameIndex;
	private readonly _import_issues: TypeScriptNodeImportIssuesContract;
	private readonly _import_declaration: TypeScriptImportSymbolDeclaration;
	private readonly _symbol_declaration: TypeScriptSymbolDeclaration;
	private readonly _type_declarations: TypeScriptTypeDeclarations;

	/** Responsibilities: _declaration metadata ownership_. **/
	public constructor(source_file: ts.SourceFile, import_issues: TypeScriptNodeImportIssuesContract) {
		this._declaration_names = new TypeScriptDeclarationNameIndex();
		this._import_issues = import_issues;
		this._import_declaration = new TypeScriptImportSymbolDeclaration(source_file);
		this._symbol_declaration = new TypeScriptSymbolDeclaration(source_file);
		this._type_declarations = new TypeScriptTypeDeclarations(source_file);
	}

	/** Responsibilities: _node metadata extraction_. **/
	public append_node_metadata(candidate: ts.Node, flags: number, line: number, state: TreeMetadataState): void {
		if ((flags & TYPESCRIPT_TREE_METADATA_FLAGS.import_symbol) !== 0) {
			state.named_symbols.push(...this._import_declaration.symbol(candidate));
		} else if ((flags & TYPESCRIPT_TREE_METADATA_FLAGS.named_symbol) !== 0) {
			state.named_symbols.push(...this._symbol_declaration.declaration_symbols(candidate));
		}
		if ((flags & TYPESCRIPT_TREE_METADATA_FLAGS.import_issue) !== 0) {
			state.import_issues.push(...this._import_issues.node_import_issues(candidate, line));
		}
		if ((flags & TYPESCRIPT_TREE_METADATA_FLAGS.type_declaration) !== 0) {
			state.type_declarations.push(...this._type_declarations.declaration_for(candidate));
		}
		if ((flags & TYPESCRIPT_TREE_METADATA_FLAGS.identifier) !== 0) {
			this._declaration_names.append_symbol_reference(candidate, line, state.symbol_references);
		}
	}

	/** Responsibilities: _identifier declaration classification_. **/
	public requires_identifier_line(node: ts.Node): boolean {
		const parent_node = node.parent;
		if (parent_node === undefined) {
			return true;
		}
		return !this._declaration_names.name_matches(parent_node, node);
	}
}
