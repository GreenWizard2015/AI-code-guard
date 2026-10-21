import ts from "typescript";
import type { LintSourceRecord } from "src/source_types";
import type { AstClassField, AstClassNodeContract, NamedSymbol } from "src/types";
import { UNUSED_SYMBOL_KIND } from "src/core/types";
import type { UnusedSymbolDefinition } from "src/core/types";
import type { UnusedSymbolDefinitionCollectorContract } from "src/linting/orchestration/runtime/global-analysis/protocols";

/** Responsibilities: _unused symbol definition collection_, _definition deduplication_. **/
export class UnusedSymbolDefinitionCollector implements UnusedSymbolDefinitionCollectorContract {
	/** Responsibilities: _Python class-field filtering_. **/
	private python_field_excluded(
		source: LintSourceRecord,
		class_node: AstClassNodeContract,
		field: AstClassField,
	): boolean {
		if (!source.python()) {
			return false;
		}
		if (field.name === "__slots__") {
			return true;
		}
		if (field.class_scope !== true) {
			return false;
		}
		return class_node.extends_external_class;
	}

	/** Responsibilities: _class definition collection_. **/
	private append_class_field(
		definitions: UnusedSymbolDefinition[],
		source: LintSourceRecord,
		class_node: AstClassNodeContract,
		field: AstClassField,
	): void {
		if (this.python_field_excluded(source, class_node, field)) {
			return;
		}
		if (field.visibility !== "public") {
			return;
		}
		definitions.push({
			file: source.relative_path,
			line: field.line + 1,
			name: field.name,
			kind: UNUSED_SYMBOL_KIND.PublicField,
			owner: class_node.name,
			owner_kind: "class",
			contract_names: class_node.interfaces,
		});
	}

	/** Responsibilities: _class definition collection_. **/
	private append_class_definition(
		definitions: UnusedSymbolDefinition[],
		source: LintSourceRecord,
		class_node: AstClassNodeContract,
	): void {
		if (class_node.protocol || class_node.type_contract) {
			return;
		}
		definitions.push({
			file: source.relative_path,
			line: class_node.start + 1,
			name: class_node.name,
			kind: UNUSED_SYMBOL_KIND.Class,
			owner: "",
			owner_kind: "module",
			contract_names: [],
		});
		for (const field of class_node.fields) {
			this.append_class_field(definitions, source, class_node, field);
		}
	}

	/** Responsibilities: _class definition aggregation_. **/
	private class_definitions(source: LintSourceRecord): UnusedSymbolDefinition[] {
		const definitions: UnusedSymbolDefinition[] = [];
		for (const class_node of source.normalized_ast.classes) {
			this.append_class_definition(definitions, source, class_node);
		}
		return definitions;
	}

	/** Responsibilities: _type definition collection_. **/
	private type_definitions(source: LintSourceRecord): UnusedSymbolDefinition[] {
		const definitions: UnusedSymbolDefinition[] = [];
		const class_names = new Set(source.normalized_ast.classes.map((class_node) => class_node.name));
		for (const declaration of source.normalized_ast.type_declarations) {
			if (class_names.has(declaration.name)) {
				continue;
			}
			definitions.push({
				file: source.relative_path,
				line: declaration.line + 1,
				name: declaration.name,
				kind: UNUSED_SYMBOL_KIND.Type,
				owner: "",
				owner_kind: "module",
				contract_names: [],
			});
		}
		this.append_type_fields(definitions, source);
		return definitions;
	}

	/** Responsibilities: _named symbol definition collection_. **/
	private named_definitions(source: LintSourceRecord): UnusedSymbolDefinition[] {
		const definitions: UnusedSymbolDefinition[] = [];
		for (const symbol of source.normalized_ast.named_symbols) {
			this.append_named_symbol(definitions, source.relative_path, symbol);
		}
		return definitions;
	}

	/** Responsibilities: _type field definition collection_. **/
	private append_type_fields(definitions: UnusedSymbolDefinition[], source: LintSourceRecord): void {
		if (!source.typescript()) {
			return;
		}
		const source_file = source.typescript_ast.source_file_node();
		for (const statement of source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				this.append_type_members(definitions, source, source_file, statement.name.text, statement.members);
				continue;
			}
			if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
				this.append_type_members(definitions, source, source_file, statement.name.text, statement.type.members);
			}
		}
	}

	/** Responsibilities: _type member definition collection_. **/
	private append_type_member(
		definitions: UnusedSymbolDefinition[],
		source: LintSourceRecord,
		source_file: ts.SourceFile,
		owner: string,
		member: ts.TypeElement,
	): void {
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
		definitions.push({
			file: source.relative_path,
			line: source_file.getLineAndCharacterOfPosition(member.getStart(source_file)).line + 1,
			name: member.name.text,
			kind: UNUSED_SYMBOL_KIND.PublicField,
			owner,
			owner_kind: "type",
			contract_names: [],
		});
	}

	/** Responsibilities: _type member definition collection_. **/
	private append_type_members(
		definitions: UnusedSymbolDefinition[],
		source: LintSourceRecord,
		source_file: ts.SourceFile,
		owner: string,
		members: readonly ts.TypeElement[],
	): void {
		for (const member of members) {
			this.append_type_member(definitions, source, source_file, owner, member);
		}
	}

	/** Responsibilities: _named variable definition classification_. **/
	private append_named_symbol(definitions: UnusedSymbolDefinition[], file: string, symbol: NamedSymbol): void {
		if (symbol.is_module_constant === true) {
			definitions.push({
				file,
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
			definitions.push({
				file,
				line: symbol.line + 1,
				name: symbol.name,
				kind: UNUSED_SYMBOL_KIND.ModuleVariable,
				owner: "",
				owner_kind: "module",
				contract_names: [],
			});
		}
	}

	/** Responsibilities: _definition deduplication_. **/
	private unique_definitions(definitions: readonly UnusedSymbolDefinition[]): UnusedSymbolDefinition[] {
		const seen = new Set<string>();
		return definitions.filter((definition) => {
			const key = `${definition.file}:${definition.line}:${definition.kind}:${definition.owner}:${definition.owner_kind}:${definition.name}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	/** Responsibilities: _source definition aggregation_. **/
	public definitions(source: LintSourceRecord): UnusedSymbolDefinition[] {
		return this.unique_definitions([
			...this.class_definitions(source),
			...this.type_definitions(source),
			...this.named_definitions(source),
		]);
	}
}
