import type { AstPythonImport, TestTargetImport } from "src/model/ast/normalized_ast_types";
import ts from "typescript";

/** Responsibilities: _import usage indexing_, _test import extraction_. **/
export class TestTargetImports {
	private readonly _usage_counts: Map<string, number>;

	/** Responsibilities: _import usage count_. **/
	private increment_usage(name: string): void {
		let count = this._usage_counts.get(name);
		if (count === undefined) {
			count = 0;
		}
		this._usage_counts.set(name, count + 1);
	}

	/** Responsibilities: _imported name count_. **/
	private usage_count(name: string): number {
		const count = this._usage_counts.get(name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}

	/** Responsibilities: _TypeScript usage indexing_. **/
	private append_typescript_usages(source: ts.SourceFile): void {
		const visit = (node: ts.Node): void => {
			if (ts.isImportDeclaration(node)) {
				return;
			}
			if (ts.isIdentifier(node)) {
				const parent = node.parent;
				let is_property_name = false;
				if (ts.isPropertyAccessExpression(parent)) {
					is_property_name = parent.name === node;
				}
				const is_declaration_name = this.declaration_name(parent, node);
				if (!is_property_name && !is_declaration_name) {
					this.increment_usage(node.text);
				}
			}
			ts.forEachChild(node, visit);
		};
		ts.forEachChild(source, visit);
	}

	/** Responsibilities: _declaration identifier matching_. **/
	private declaration_name(parent: ts.Node, name: ts.Identifier): boolean {
		if (ts.isClassDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
			return parent.name === name;
		}
		if (ts.isTypeAliasDeclaration(parent) || ts.isEnumDeclaration(parent) || ts.isModuleDeclaration(parent)) {
			return parent.name === name;
		}
		if (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isMethodDeclaration(parent)) {
			return parent.name === name;
		}
		if (ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent)) {
			return parent.name === name;
		}
		return false;
	}

	/** Responsibilities: _default import extraction_. **/
	private default_import(clause: ts.ImportClause, specifier: string): TestTargetImport[] {
		if (clause.name === undefined) {
			return [];
		}
		return [{ specifier, names: ["default"], usage_count: this.usage_count(clause.name.text) }];
	}

	/** Responsibilities: _named import extraction_. **/
	private named_imports(clause: ts.ImportClause, specifier: string): TestTargetImport[] {
		const bindings = clause.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements
			.filter((element) => !element.isTypeOnly)
			.map((element) => {
				let imported_name = element.name.text;
				if (element.propertyName !== undefined) {
					imported_name = element.propertyName.text;
				}
				return {
					specifier,
					names: [imported_name],
					usage_count: this.usage_count(element.name.text),
				};
			});
	}

	/** Responsibilities: _runtime import extraction_. **/
	private runtime_imports(statement: ts.Statement): TestTargetImport[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return [];
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return [];
		}
		if (clause.isTypeOnly) {
			return [];
		}
		const specifier = statement.moduleSpecifier.text;
		return [...this.default_import(clause, specifier), ...this.named_imports(clause, specifier)];
	}

	/** Responsibilities: _Python import usage indexing_. **/
	private append_python_usage(source_text: string): void {
		const source_lines = source_text
			.split("\n")
			.filter((line) => !/^\s*(?:from\s+\S+\s+import|import\s+|#)/.test(line))
			.join("\n");
		const source_names = source_lines.match(/[A-Za-z_]\w*/g);
		if (source_names === null) {
			return;
		}
		for (const name of source_names) {
			this.increment_usage(name);
		}
	}

	/** Responsibilities: _Python target import construction_. **/
	private python_imports(imports: readonly AstPythonImport[]): TestTargetImport[] {
		const result: TestTargetImport[] = [];
		for (const item of imports) {
			for (const imported of item.names) {
				let local_name = imported.name;
				if (imported.alias.length > 0) {
					local_name = imported.alias;
				}
				result.push({
					specifier: item.module,
					names: [imported.name],
					usage_count: this.usage_count(local_name),
				});
			}
		}
		return result;
	}

	/** Responsibilities: _target usage index initialization_. **/
	public constructor() {
		this._usage_counts = new Map<string, number>();
	}

	/** Responsibilities: _TypeScript target imports_. **/
	public typescript(source: ts.SourceFile): TestTargetImport[] {
		this._usage_counts.clear();
		this.append_typescript_usages(source);
		return source.statements.flatMap((statement) => this.runtime_imports(statement));
	}

	/** Responsibilities: _Python target imports_. **/
	public python(imports: readonly AstPythonImport[], source_text: string): TestTargetImport[] {
		this._usage_counts.clear();
		this.append_python_usage(source_text);
		return this.python_imports(imports);
	}
}
