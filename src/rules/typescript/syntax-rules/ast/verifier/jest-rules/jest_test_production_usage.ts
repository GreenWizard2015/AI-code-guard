import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { JestSuiteCollectorContract } from "src/testing_protocols";
import { TestPathKind } from "src/types";
import ts from "typescript";

/** Responsibilities: _production import extraction_, _behavior usage validation_. **/
export class JestTestProductionUsage {
	private readonly _suite_collector: JestSuiteCollectorContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _usage_rule: RuleContract;
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _resolver: TypeScriptModuleResolverContract;
	private readonly _names: Set<string>;

	/** Responsibilities: _imported production name collection_. **/
	private append_named_imports(module_path: string, bindings: ts.NamedImports): void {
		for (const element of bindings.elements) {
			if (element.isTypeOnly) {
				continue;
			}
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			const resolved = this._resolver.resolve({ file: module_path, name: imported_name });
			const kind = this._resolver.symbol_kind(resolved);
			if (kind === ResolvedTypeScriptDeclarationKind.Class || kind === ResolvedTypeScriptDeclarationKind.Function) {
				this._names.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _named binding collection_. **/
	private append_clause_bindings(statement: ts.ImportDeclaration, clause: ts.ImportClause): void {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const module_path = this._resolver.module_symbol(this._source_file.fileName, statement.moduleSpecifier.text);
		if (this._test_path_syntax.classify(module_path).has(TestPathKind.TestFile)) {
			return;
		}
		const bindings = clause.namedBindings;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			this.append_named_imports(module_path, bindings);
		}
	}

	/** Responsibilities: _import declaration collection_. **/
	private append_import(statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined || clause.isTypeOnly) {
			return;
		}
		this.append_clause_bindings(statement, clause);
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
	private production_call(node: ts.Node): boolean {
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			return this.imported_receiver(node.expression);
		}
		return false;
	}

	/** Responsibilities: _import receiver identification_. **/
	private imported_receiver(expression: ts.Expression): boolean {
		if (ts.isIdentifier(expression)) {
			return this._names.has(expression.text);
		}
		if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
			return this.imported_receiver(expression.expression);
		}
		return false;
	}

	/** Responsibilities: _production import AST traversal_. **/
	private node_uses_import(node: ts.Node, root: boolean): boolean {
		if (!root) {
			if (ts.isFunctionLike(node)) {
				if (!this.callback_invocation(node)) {
					return false;
				}
			}
		}
		if (this.production_call(node)) {
			return true;
		}
		let found = false;
		node.forEachChild((child) => {
			if (!found) {
				found = this.node_uses_import(child, false);
			}
		});
		return found;
	}

	/** Responsibilities: _production usage rule setup_. **/
	public constructor(
		suite_collector: JestSuiteCollectorContract,
		test_path_syntax: TestPathSyntaxContract,
		file: string,
		source_file: ts.SourceFile,
		resolver: TypeScriptModuleResolverContract,
	) {
		this._suite_collector = suite_collector;
		this._test_path_syntax = test_path_syntax;
		this._usage_rule = new DiagnosticRule("test-production-usage");
		this._file = file;
		this._source_file = source_file;
		this._resolver = resolver;
		this._names = new Set();
	}

	/** Responsibilities: _production import collection_. **/
	public production_names(): ReadonlySet<string> {
		for (const statement of this._source_file.statements) {
			this.append_import(statement);
		}
		return this._names;
	}

	/** Responsibilities: _imported production behavior search_. **/
	public uses_imported_behavior(body: ts.Node): boolean {
		return this.node_uses_import(body, true);
	}

	/** Responsibilities: _per-test production behavior diagnostics_. **/
	public append(violations: ViolationContract[], tests: ts.CallExpression[]): void {
		this.production_names();
		for (const test of tests) {
			this._suite_collector.with_callback(test, (callback) => {
				if (callback.body === undefined || this.uses_imported_behavior(callback.body)) {
					return;
				}
				const line = this._source_file.getLineAndCharacterOfPosition(test.getStart(this._source_file)).line + 1;
				violations.push(this._usage_rule.violation(this._file, line, {}));
			});
		}
	}
}
