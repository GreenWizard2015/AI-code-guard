import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstCallableNode, AstPythonImport } from 'src/types';

import type { NamedDeclaration } from 'src/bridge/ts/runner/orchestration/runtime/python/types';

/** Responsibilities: _normalization Python callable import_. **/
export class Declarations {
	private readonly prefix_separator = '_';

	/** Responsibilities: _normalization callable declaration conversion_. **/
	private declaration_from_function(node: AstCallableNode): NamedDeclaration {
		return {
			name: node.name,
			line: node.start,
			has_self: node.has_self === true,
		};
	}

	/** Responsibilities: _aggregation declarations normalization AST_. **/
	private append_declaration(
		groups: Map<string, NamedDeclaration[]>,
		declaration: NamedDeclaration
	): void {
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

	/** Responsibilities: _Python imports named conversion_. **/
	private import_declarations(python_imports: AstPythonImport[]): NamedDeclaration[] {
		const declarations: NamedDeclaration[] = [];
		for (const import_node of python_imports) {
			declarations.push(
				...import_node.names
					.filter(name => name.name.startsWith('_') || name.alias?.startsWith('_'))
					.map(name => {
						let alias = '';
						if (name.alias !== undefined) {
							alias = name.alias;
						}
						return {
						name: this.imported_name(alias, name.name),
						line: import_node.line,
						has_self: false,
						};
					})
			);
		}
		return declarations;
	}

	/** Responsibilities: _resolution local name imported_. **/
	private imported_name(alias: string, name: string): string {
		if (alias.length === 0) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _derivation class-like private prefix_. **/
	private class_like_prefix(name: string): string {
		let first = name[1];
		if (first === undefined) {
			first = '';
		}
		const end = name.indexOf(this.prefix_separator, 2);
		const is_uppercase = (first === first.toUpperCase()) && (first !== first.toLowerCase());
		if (name[0] !== '_' || end < 0) {
			return '';
		}
		if (!is_uppercase) {
			return '';
		}
		return `${name.slice(0, end)}${this.prefix_separator}`;
	}

	/** Responsibilities: _creation class-like-prefix diagnostic declaration_. **/
	private create_declaration_violation(
		file: string,
		prefix: string,
		group: NamedDeclaration[]
	): Violation {
		const declaration_line = group[0].line + 1;
		const group_size = group.length;
		const class_name = prefix.slice(1, -1);
		const rule = new DiagnosticRule('class-like-prefix');
		return rule.violation(file, declaration_line, {
			prefix,
			count: String(group_size),
			class_name,
		});
	}

	/** Responsibilities: _group declarations class-like prefix_. **/
	public declaration_groups_from(
		functions: AstCallableNode[],
		python_imports: AstPythonImport[]
	): Map<string, NamedDeclaration[]> {
		const groups = new Map<string, NamedDeclaration[]>();
		const declarations = functions.map(node => this.declaration_from_function(node));
		declarations.push(...this.import_declarations(python_imports));
		for (const declaration of declarations) {
			this.append_declaration(groups, declaration);
		}
		return groups;
	}

	/** Responsibilities: _aggregation class-like-prefix violations Python_. **/
	public append_prefix_violations(
		violations: Violation[],
		file: string,
		functions: AstCallableNode[],
		python_imports: AstPythonImport[]
	): void {
		const groups = this.declaration_groups_from(functions, python_imports);
		for (const [prefix, group] of groups) {
if (group.length < 2 || group.every(declaration => declaration.has_self)) {
				continue;
			}
			violations.push(this.create_declaration_violation(file, prefix, group));
		}
	}
}
