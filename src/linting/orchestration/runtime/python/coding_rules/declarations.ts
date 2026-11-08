import type { AstCallableNode, AstPythonImport } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { RuleContract } from "src/reporting_protocols";

import type { NamedDeclaration } from "src/model_types";

/** Responsibilities: _import declaration grouping_, _class prefix diagnostics_. **/
export class Declarations {
	private readonly prefix_separator = "_";
	private readonly _class_prefix_rule: RuleContract;

	/** Responsibilities: _normalization callable declaration conversion_. **/
	private declaration_from_function(node: AstCallableNode): NamedDeclaration {
		return {
			name: node.identity.name,
			line: node.identity.start,
			has_self: node.declaration.has_self === true,
		};
	}

	/** Responsibilities: _aggregation declarations normalization AST_. **/
	private append_declaration(groups: Map<string, NamedDeclaration[]>, declaration: NamedDeclaration): void {
		const prefix = this.class_like_prefix(declaration.name);
		if (prefix.length === 0) {
			return;
		}
		const declarations = groups.get(prefix);
		if (declarations === undefined) {
			groups.set(prefix, [declaration]);
			return;
		}
		groups.set(prefix, [...declarations, declaration]);
	}

	/** Responsibilities: _private imported declaration conversion_. **/
	private declarations_for_import(import_node: AstPythonImport): NamedDeclaration[] {
		const declarations: NamedDeclaration[] = [];
		for (const imported_name of import_node.names) {
			let private_alias = false;
			if (imported_name.alias !== undefined) {
				private_alias = imported_name.alias.startsWith("_");
			}
			if (!imported_name.name.startsWith("_") && !private_alias) {
				continue;
			}
			let name = imported_name.name;
			if (imported_name.alias.length > 0) {
				name = imported_name.alias;
			}
			declarations.push({ name, line: import_node.line, has_self: false });
		}
		return declarations;
	}

	/** Responsibilities: _derivation class-like private prefix_. **/
	private class_like_prefix(name: string): string {
		let first = name[1];
		if (first === undefined) {
			first = "";
		}
		const end = name.indexOf(this.prefix_separator, 2);
		const is_uppercase = first === first.toUpperCase() && first !== first.toLowerCase();
		if (name[0] !== "_" || end < 0) {
			return "";
		}
		if (!is_uppercase) {
			return "";
		}
		return `${name.slice(0, end)}${this.prefix_separator}`;
	}

	/** Responsibilities: _creation class-like-prefix diagnostic declaration_. **/
	private create_declaration_violation(file: string, prefix: string, group: NamedDeclaration[]): ViolationContract {
		const declaration = group.at(0);
		if (declaration === undefined) {
			throw new Error("A class-like prefix diagnostic requires a declaration.");
		}
		const declaration_line = declaration.line + 1;
		const group_size = group.length;
		const class_name = prefix.slice(1, -1);
		return this._class_prefix_rule.violation(file, declaration_line, {
			prefix,
			count: String(group_size),
			class_name,
		});
	}

	/** Responsibilities: _class-prefix rule setup_. **/
	public constructor(class_prefix_rule: RuleContract) {
		this._class_prefix_rule = class_prefix_rule;
	}

	/** Responsibilities: _group declarations class-like prefix_. **/
	public declaration_groups_from(
		functions: AstCallableNode[],
		python_imports: AstPythonImport[],
	): Map<string, NamedDeclaration[]> {
		const groups = new Map<string, NamedDeclaration[]>();
		const declarations = functions.map((node) => this.declaration_from_function(node));
		for (const import_node of python_imports) {
			declarations.push(...this.declarations_for_import(import_node));
		}
		for (const declaration of declarations) {
			this.append_declaration(groups, declaration);
		}
		return groups;
	}

	/** Responsibilities: _aggregation class-like-prefix violations Python_. **/
	public append_prefix_violations(
		violations: ViolationContract[],
		file: string,
		functions: AstCallableNode[],
		python_imports: AstPythonImport[],
	): void {
		const groups = this.declaration_groups_from(functions, python_imports);
		for (const [prefix, group] of groups) {
			if (group.length < 2) {
				continue;
			}
			if (group.every((declaration) => declaration.has_self)) {
				continue;
			}
			violations.push(this.create_declaration_violation(file, prefix, group));
		}
	}
}
