import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { NamedDeclaration } from 'src/types';

/** Responsibilities: _extraction named declarations group_. **/
export class TypeScriptDeclarations {
	private readonly prefix_separator = '_';
	private readonly private_prefix = '_';

	/** Responsibilities: _extraction function-valued variable declaration_. **/
	private variable_declaration(
		item: ts.VariableDeclaration,
		source_file: ts.SourceFile
	): NamedDeclaration[] {
		const initializer = item.initializer;
		if (!initializer || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) {
			return [];
		}
		return [this.declaration(
			item.name.getText(source_file),
			item,
			source_file,
			initializer.parameters
		)];
	}

	/** Responsibilities: _extraction private named import_. **/
	private imported_declaration(
		element: ts.ImportSpecifier,
		source_file: ts.SourceFile
	): NamedDeclaration[] {
		if (element.name.text.startsWith(this.private_prefix)) {
			return [this.declaration(element.name.text, element, source_file, [])];
		}
		return [];
	}

	/** Responsibilities: _construction normalization declaration metadata_. **/
	private declaration(
		name: string,
		node: ts.Node,
		source_file: ts.SourceFile,
		parameters: readonly ts.ParameterDeclaration[]
	): NamedDeclaration {
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		const has_self = parameters.length > 0 && parameters[0].name.getText(source_file) === 'self';
		return { name, line, has_self };
	}

	/** Responsibilities: _extraction named top-level function_. **/
	private top_function_declarations(
		statement: ts.Statement,
		source_file: ts.SourceFile
	): NamedDeclaration[] {
		if (!ts.isFunctionDeclaration(statement) || !statement.name) {
			return [];
		}
		return [this.declaration(statement.name.text, statement, source_file, statement.parameters)];
	}

	/** Responsibilities: _function-valued top-level variables extraction_. **/
	private top_variable_declarations(
		statement: ts.Statement,
		source_file: ts.SourceFile
	): NamedDeclaration[] {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return statement.declarationList.declarations.flatMap(item => this.variable_declaration(item, source_file));
	}

	/** Responsibilities: _extraction private named imports_. **/
	private named_imports(statement: ts.Statement, source_file: ts.SourceFile): NamedDeclaration[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements.flatMap(element => this.imported_declaration(element, source_file));
	}

	/** Responsibilities: _derivation class-like private prefix_. **/
	private prefix_for(name: string): string {
		let first = name[1];
		if (first === undefined) {
			first = '';
		}
		const end = name.indexOf(this.prefix_separator, 2);
		if (!this.valid_prefix(name, first, end)) {
			return '';
		}
		return `${name.slice(0, end)}${this.prefix_separator}`;
	}

	/** Responsibilities: _validation capitalization shape private_. **/
	private valid_prefix(name: string, first: string, end: number): boolean {
		if (name[0] !== '_' || end < 0) {
			return false;
		}
if (first === first.toLowerCase() || first !== first.toUpperCase()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _aggregation violations grouped declaration_. **/
	private append_group_violations(
		violations: Violation[],
		file: string,
		groups: Map<string, NamedDeclaration[]>
	): void {
		for (const [prefix, group] of groups) {
			const violation = this.group_violation(file, prefix, group);
			violations.push(...violation);
		}
	}

	/** Responsibilities: _creation class-like-prefix violation declaration_. **/
	private group_violation(
		file: string,
		prefix: string,
		group: NamedDeclaration[]
	): Violation[] {
if (group.length < 2 || group.every(declaration => declaration.has_self)) {
			return [];
		}
		const class_name = prefix.slice(1, -1);
		const rule = new DiagnosticRule('class-like-prefix');
		return [rule.violation(file, group[0].line + 1, {
			prefix,
				count: String(group.length),
			class_name,
		})];
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

	/** Responsibilities: _collection declarations aggregation prefix-group_. **/
	public append_prefix_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const declarations = source_file.statements.flatMap(statement => [
			...this.top_function_declarations(statement, source_file),
			...this.top_variable_declarations(statement, source_file),
			...this.named_imports(statement, source_file),
		]);
		const groups = this.prefix_groups(declarations);
		this.append_group_violations(violations, file, groups);
	}
}
