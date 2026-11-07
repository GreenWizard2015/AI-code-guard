import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type { NamedDeclaration } from "src/types";
import ts from "typescript";

/** Responsibilities: _named declaration extraction_, _prefix group diagnostics_. **/
export class TypeScriptDeclarations {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _declaration_candidates: readonly ts.Node[];
	private readonly prefix_separator = "_";
	private readonly private_prefix = "_";

	/** Responsibilities: _extraction function-valued variable declaration_. **/
	private variable_declaration(item: ts.VariableDeclaration): NamedDeclaration[] {
		const initializer = item.initializer;
		if (!initializer || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) {
			return [];
		}
		return [this.declaration(item.name.getText(this._source_file), item, initializer.parameters)];
	}

	/** Responsibilities: _extraction private named import_. **/
	private imported_declaration(element: ts.ImportSpecifier): NamedDeclaration[] {
		if (element.name.text.startsWith(this.private_prefix)) {
			return [this.declaration(element.name.text, element, [])];
		}
		return [];
	}

	/** Responsibilities: _construction normalization declaration metadata_. **/
	private declaration(name: string, node: ts.Node, parameters: readonly ts.ParameterDeclaration[]): NamedDeclaration {
		const line = this._source_file.getLineAndCharacterOfPosition(node.getStart(this._source_file)).line;
		const first_parameter = parameters.at(0);
		const has_self = first_parameter !== undefined && first_parameter.name.getText(this._source_file) === "self";
		return { name, line, has_self };
	}

	/** Responsibilities: _extraction named top-level function_. **/
	private top_function_declarations(statement: ts.FunctionDeclaration): NamedDeclaration[] {
		if (!statement.name) {
			return [];
		}
		return [this.declaration(statement.name.text, statement, statement.parameters)];
	}

	/** Responsibilities: _extraction private named imports_. **/
	private named_imports(statement: ts.ImportDeclaration): NamedDeclaration[] {
		const bindings = statement.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements.flatMap((element) => this.imported_declaration(element));
	}

	/** Responsibilities: _top-level named declaration extraction_. **/
	private declarations_for(statement: ts.Node): NamedDeclaration[] {
		if (ts.isFunctionDeclaration(statement)) {
			return this.top_function_declarations(statement);
		}
		if (ts.isVariableStatement(statement)) {
			return statement.declarationList.declarations.flatMap((item) => this.variable_declaration(item));
		}
		if (ts.isImportDeclaration(statement)) {
			return this.named_imports(statement);
		}
		return [];
	}

	/** Responsibilities: _derivation class-like private prefix_. **/
	private prefix_for(name: string): string {
		let first = name[1];
		if (first === undefined) {
			first = "";
		}
		const end = name.indexOf(this.prefix_separator, 2);
		if (name[0] !== "_" || end < 0) {
			return "";
		}
		if (first === first.toLowerCase() || first !== first.toUpperCase()) {
			return "";
		}
		return `${name.slice(0, end)}${this.prefix_separator}`;
	}

	/** Responsibilities: _aggregation violations grouped declaration_. **/
	private append_group_violations(
		violations: ViolationContract[],
		file: string,
		groups: Map<string, NamedDeclaration[]>,
	): void {
		for (const [prefix, group] of groups) {
			const violation = this.group_violation(file, prefix, group);
			violations.push(...violation);
		}
	}

	/** Responsibilities: _creation class-like-prefix violation declaration_. **/
	private group_violation(file: string, prefix: string, group: NamedDeclaration[]): ViolationContract[] {
		if (group.length < 2) {
			return [];
		}
		if (group.every((declaration) => declaration.has_self)) {
			return [];
		}
		const first_declaration = group.at(0);
		if (first_declaration === undefined) {
			return [];
		}
		const class_name = prefix.slice(1, -1);
		const rule = new DiagnosticRule("class-like-prefix");
		return [
			rule.violation(file, first_declaration.line + 1, {
				prefix,
				count: String(group.length),
				class_name,
			}),
		];
	}

	/** Responsibilities: _collection indexed declarations_. **/
	public constructor(file: string, source_file: ts.SourceFile, declaration_candidates: readonly ts.Node[]) {
		this._file = file;
		this._source_file = source_file;
		this._declaration_candidates = declaration_candidates;
	}

	/** Responsibilities: _indexed declaration violations_. **/
	public append(violations: ViolationContract[]): void {
		const declarations = this._declaration_candidates.flatMap((node) => this.declarations_for(node));
		const groups = this.prefix_groups(declarations);
		this.append_group_violations(violations, this._file, groups);
	}

	/** Responsibilities: _group declarations their class-like_. **/
	public prefix_groups(declarations: NamedDeclaration[]): Map<string, NamedDeclaration[]> {
		const groups = new Map<string, NamedDeclaration[]>();
		for (const declaration of declarations) {
			const prefix = this.prefix_for(declaration.name);
			if (prefix) {
				let group = groups.get(prefix);
				if (!group) {
					group = [];
				}
				groups.set(prefix, [...group, declaration]);
			}
		}
		return groups;
	}
}
