import ts from "typescript";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { TestPathSyntaxContract, JestSuiteCollectorContract } from "src/testing_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";

/** Responsibilities: _production import extraction_, _behavior usage validation_. **/
export class JestTestProductionUsage {
	private readonly suite_collector: JestSuiteCollectorContract;
	private readonly test_path_syntax: TestPathSyntaxContract;
	private readonly usage_rule: DiagnosticRule;

	/** Responsibilities: _imported production name collection_. **/
	private append_named_imports(
		names: Set<string>,
		module_path: string,
		bindings: ts.NamedImports,
		resolver: TypeScriptModuleResolverContract,
	): void {
		for (const element of bindings.elements) {
			if (element.isTypeOnly) {
				continue;
			}
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			const kind = resolver.symbol_kind(module_path, imported_name);
			if (kind === ResolvedTypeScriptDeclarationKind.Class || kind === ResolvedTypeScriptDeclarationKind.Function) {
				names.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _import declaration collection_. **/
	private append_import(
		names: Set<string>,
		source_file: ts.SourceFile,
		statement: ts.Statement,
		resolver: TypeScriptModuleResolverContract,
	): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return;
		}
		if (clause.isTypeOnly) {
			return;
		}
		this.append_clause_bindings(names, source_file, statement, clause, resolver);
	}

	/** Responsibilities: _named binding collection_. **/
	private append_clause_bindings(
		names: Set<string>,
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		clause: ts.ImportClause,
		resolver: TypeScriptModuleResolverContract,
	): void {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const module_path = resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (this.test_path_syntax.test_file(module_path, false)) {
			return;
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (ts.isNamedImports(bindings)) {
			this.append_named_imports(names, module_path, bindings, resolver);
		}
	}

	/** Responsibilities: _callback invocation state_. **/
	private callback_invocation(node: ts.SignatureDeclaration): boolean {
		const parent = node.parent;
		if (ts.isCallExpression(parent)) {
			if (parent.expression === node) {
				return true;
			}
			return parent.arguments.some((argument) => argument === node);
		}
		return false;
	}

	/** Responsibilities: _production invocation nodes_. **/
	private production_call(node: ts.Node, names: ReadonlySet<string>): boolean {
		if (ts.isCallExpression(node)) {
			return this.imported_receiver(node.expression, names);
		}
		if (ts.isNewExpression(node)) {
			return this.imported_receiver(node.expression, names);
		}
		return false;
	}

	/** Responsibilities: _import receiver identification_. **/
	private imported_receiver(expression: ts.Expression, names: ReadonlySet<string>): boolean {
		if (ts.isIdentifier(expression)) {
			return names.has(expression.text);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.imported_receiver(expression.expression, names);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.imported_receiver(expression.expression, names);
		}
		return false;
	}

	/** Responsibilities: _production import AST traversal_. **/
	private node_uses_import(node: ts.Node, root: boolean, names: ReadonlySet<string>): boolean {
		if (!root && ts.isFunctionLike(node)) {
			if (!this.callback_invocation(node)) {
				return false;
			}
		}
		if (this.production_call(node, names)) {
			return true;
		}
		let found = false;
		node.forEachChild((child) => {
			if (!found) {
				found = this.node_uses_import(child, false, names);
			}
		});
		return found;
	}

	/** Responsibilities: _production usage rule setup_. **/
	public constructor(suite_collector: JestSuiteCollectorContract, test_path_syntax: TestPathSyntaxContract) {
		this.suite_collector = suite_collector;
		this.test_path_syntax = test_path_syntax;
		this.usage_rule = new DiagnosticRule("test-production-usage");
	}

	/** Responsibilities: _production import collection_. **/
	public production_names(source_file: ts.SourceFile, resolver: TypeScriptModuleResolverContract): ReadonlySet<string> {
		const names = new Set<string>();
		for (const statement of source_file.statements) {
			this.append_import(names, source_file, statement, resolver);
		}
		return names;
	}

	/** Responsibilities: _imported production behavior search_. **/
	public uses_imported_behavior(body: ts.Node, names: ReadonlySet<string>): boolean {
		return this.node_uses_import(body, true, names);
	}

	/** Responsibilities: _per-test production behavior diagnostics_. **/
	public append(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		tests: ts.CallExpression[],
		resolver: TypeScriptModuleResolverContract,
	): void {
		const production_names = this.production_names(source_file, resolver);
		for (const test of tests) {
			this.suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined) {
					return;
				}
				if (this.uses_imported_behavior(callback.body, production_names)) {
					return;
				}
				const line = source_file.getLineAndCharacterOfPosition(test.getStart(source_file)).line + 1;
				violations.push(this.usage_rule.violation(file, line));
			});
		}
	}
}
