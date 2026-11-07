import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type { UnusedSymbolDefinitionCollectorContract } from "src/contracts/protocols/global_analysis_protocols";
import { UNUSED_SYMBOL_KIND } from "src/core/types";
import type { UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolDefinitionCollection } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_definition_collection";
import type {
	AstClassField,
	AstClassNode,
	NamedSymbol,
	NormalizedAstSource,
	NormalizedAstSymbolReferences,
} from "src/model/ast/normalized_ast_types";
import type { LintSourceRecordData } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _unused symbol definition collection_, _definition deduplication_. **/
export class UnusedSymbolDefinitionCollector implements UnusedSymbolDefinitionCollectorContract {
	private readonly _source: LintSourceRecordData;
	private readonly _declarations: NormalizedAstSource;
	private readonly _references: NormalizedAstSymbolReferences;
	private readonly _definitions_index: UnusedSymbolDefinitionCollection;

	/** Responsibilities: _Python class-field filtering_. **/
	private python_field_excluded(external_class: boolean, field: AstClassField): boolean {
		if (this._source.language !== "python") {
			return false;
		}
		if (field.name === "__slots__") {
			return true;
		}
		if (field.class_scope !== true) {
			return false;
		}
		return external_class;
	}

	/** Responsibilities: _class definition collection_. **/
	private append_class_field(class_node: AstClassNode, field: AstClassField): void {
		if (this.python_field_excluded(class_node.classification.extends_external_class, field)) {
			return;
		}
		if (field.visibility !== "public") {
			return;
		}
		this._definitions_index.append({
			file: this._source.relative_path,
			line: field.line + 1,
			name: field.name,
			kind: UNUSED_SYMBOL_KIND.PublicField,
			owner: class_node.identity.name,
			owner_kind: "class",
			contract_names: class_node.structure.interfaces,
		});
	}

	/** Responsibilities: _class definition collection_. **/
	private append_class_definition(class_node: AstClassNode): void {
		if (class_node.classification.protocol || class_node.classification.type_contract) {
			return;
		}
		this._definitions_index.append({
			file: this._source.relative_path,
			line: class_node.identity.start + 1,
			name: class_node.identity.name,
			kind: UNUSED_SYMBOL_KIND.Class,
			owner: "",
			owner_kind: "module",
			contract_names: [],
		});
		for (const field of class_node.field_analysis.fields) {
			this.append_class_field(class_node, field);
		}
	}

	/** Responsibilities: _class definition aggregation_. **/
	private class_definitions(): void {
		for (const class_node of this._declarations.classes) {
			this.append_class_definition(class_node);
		}
	}

	/** Responsibilities: _type definition collection_. **/
	private type_definitions(): void {
		const class_names = new Set(this._declarations.classes.map((class_node) => class_node.identity.name));
		for (const declaration of this._references.type_declarations) {
			if (class_names.has(declaration.name)) {
				continue;
			}
			this._definitions_index.append({
				file: this._source.relative_path,
				line: declaration.line + 1,
				name: declaration.name,
				kind: UNUSED_SYMBOL_KIND.Type,
				owner: "",
				owner_kind: "module",
				contract_names: [],
			});
		}
		this.append_type_fields();
	}

	/** Responsibilities: _named symbol definition collection_. **/
	private named_definitions(): void {
		for (const symbol of this._references.named_symbols) {
			if (this._source.language === "python" && symbol.name === "__all__") {
				continue;
			}
			this.append_named_symbol(symbol);
		}
	}

	/** Responsibilities: _type field definition collection_. **/
	private append_type_fields(): void {
		if (this._source.language !== TYPESCRIPT_CACHE_OWNER) {
			return;
		}
		const source_file = this._source.typescript_ast.source_file_node();
		for (const statement of source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				this.append_type_members(source_file, statement.name.text, statement.members);
				continue;
			}
			if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
				this.append_type_members(source_file, statement.name.text, statement.type.members);
			}
		}
	}

	/** Responsibilities: _type member definition collection_. **/
	private append_type_member(source_file: ts.SourceFile, owner: string, member: ts.TypeElement): void {
		if (!ts.isPropertySignature(member)) {
			return;
		}
		if (member.name === undefined) {
			return;
		}
		const supported_name =
			ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name);
		if (!supported_name) {
			return;
		}
		this._definitions_index.append({
			file: this._source.relative_path,
			line: source_file.getLineAndCharacterOfPosition(member.getStart(source_file)).line + 1,
			name: member.name.text,
			kind: UNUSED_SYMBOL_KIND.PublicField,
			owner,
			owner_kind: "type",
			contract_names: [],
		});
	}

	/** Responsibilities: _type member definition collection_. **/
	private append_type_members(source_file: ts.SourceFile, owner: string, members: readonly ts.TypeElement[]): void {
		for (const member of members) {
			this.append_type_member(source_file, owner, member);
		}
	}

	/** Responsibilities: _named variable definition classification_. **/
	private append_named_symbol(symbol: NamedSymbol): void {
		if (symbol.is_module_constant === true) {
			this._definitions_index.append({
				file: this._source.relative_path,
				line: symbol.line + 1,
				name: symbol.name,
				kind: UNUSED_SYMBOL_KIND.Constant,
				owner: "",
				owner_kind: "module",
				contract_names: [],
			});
			return;
		}
		if (symbol.is_module_variable === true) {
			this._definitions_index.append({
				file: this._source.relative_path,
				line: symbol.line + 1,
				name: symbol.name,
				kind: UNUSED_SYMBOL_KIND.ModuleVariable,
				owner: "",
				owner_kind: "module",
				contract_names: [],
			});
		}
	}

	/** Responsibilities: _source definition aggregation_. **/
	public constructor(source: LintSourceRecordData) {
		this._source = source;
		this._declarations = source.normalized_ast.source;
		this._references = source.normalized_ast.references;
		this._definitions_index = new UnusedSymbolDefinitionCollection();
	}

	/** Responsibilities: _source definitions_. **/
	public definitions(): UnusedSymbolDefinition[] {
		this.class_definitions();
		this.type_definitions();
		this.named_definitions();
		return this._definitions_index.all();
	}
}
