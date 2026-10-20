import { ProxyArgumentMatcher } from "src/rules/typescript/syntax-rules/callables/proxy_argument_matcher";
import type { ProxyCallContract } from "src/runtime_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { ProxyRulesContract } from "src/analysis_protocols";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/typescript-aliases/type_script_member_aliases";
import ts from "typescript";
import type { SourceFileStringSetCache } from "src/source_types";

/** Responsibilities: _proxy callable classification_, _proxy lambda detection_. **/
export class ProxyRules implements ProxyRulesContract {
	private readonly proxy_call: ProxyCallContract;
	private readonly argument_matcher: ProxyArgumentMatcher;
	private readonly expression_aliases: TypeScriptExpressionAliases;
	private readonly this_aliases: TypeScriptMemberAliasesContract;
	private readonly platform_imports: SourceFileStringSetCache;

	/** Responsibilities: _parameter name collection_. **/
	private parameter_names(node: ts.Node): readonly string[] {
		if (!ts.isFunctionLike(node)) {
			return [];
		}
		const identifiers = node.parameters.map((parameter) => parameter.name).filter(ts.isIdentifier);
		if (identifiers.length !== node.parameters.length) {
			return [];
		}
		return identifiers.map((identifier) => identifier.text);
	}

	/** Responsibilities: _callable target expression_. **/
	private target_expression(call: ts.Node): ts.Expression {
		if (ts.isCallExpression(call)) {
			return call.expression;
		}
		if (ts.isNewExpression(call)) {
			return call.expression;
		}
		if (ts.isPropertyAccessExpression(call)) {
			return call;
		}
		throw new Error("Unsupported proxy call expression.");
	}

	/** Responsibilities: _platform import catalog_. **/
	private platform_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const names = new Set<string>();
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			if (!statement.moduleSpecifier.text.startsWith("node:")) {
				continue;
			}
			const bindings = statement.importClause?.namedBindings;
			if (bindings === undefined || !ts.isNamedImports(bindings)) {
				continue;
			}
			for (const element of bindings.elements) {
				names.add(element.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _cached source platform imports_. **/
	private platform_import_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached = this.platform_imports.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const names = this.platform_names(source_file);
		this.platform_imports.set(source_file, names);
		return names;
	}

	/** Responsibilities: _platform API detection_. **/
	private platform_call(call: ts.Node): boolean {
		if (!ts.isCallExpression(call)) {
			return false;
		}
		if (!ts.isIdentifier(call.expression)) {
			return false;
		}
		return this.platform_import_names(call.getSourceFile()).has(call.expression.text);
	}

	/** Responsibilities: _this-target classification_. **/
	private this_call(call: ts.Node): boolean {
		if (!ts.isCallExpression(call)) {
			return false;
		}
		const expression = this.expression_aliases.unwrapped(call.expression);
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.expression.kind === ts.SyntaxKind.ThisKeyword;
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.this_aliases.member(expression, call);
	}

	/** Responsibilities: _proxy lambda target_. **/
	private proxy_lambda_target(node: ts.Node): boolean {
		const parent = node.parent;
		if (!ts.isPropertyAssignment(parent)) {
			return false;
		}
		if (parent.initializer !== node) {
			return false;
		}
		const calls: readonly ts.Node[] = this.proxy_call.proxy_call(node);
		if (calls.length === 0) {
			return false;
		}
		return this.this_call(calls[0]);
	}

	/** Responsibilities: _proxy rule dependency initialization_. **/
	public constructor(proxy_call: ProxyCallContract) {
		this.argument_matcher = new ProxyArgumentMatcher();
		this.expression_aliases = new TypeScriptExpressionAliases("");
		this.this_aliases = new TypeScriptMemberAliases("this", () => "");
		this.platform_imports = new WeakMap<ts.SourceFile, ReadonlySet<string>>();
		this.proxy_call = proxy_call;
	}

	/** Responsibilities: _callable declaration forwarding_. **/
	public proxy_callable(node: ts.Node): boolean {
		const calls: readonly ts.Node[] = this.proxy_call.proxy_call(node);
		if (calls.length === 0) {
			return false;
		}
		const call = calls[0];
		if (this.platform_call(call)) {
			return false;
		}
		const target_expression = this.target_expression(call);
		if (!this.proxy_call.supports_target_expression(target_expression)) {
			return false;
		}
		const parameters = this.parameter_names(node);
		return this.argument_matcher.matches(call, parameters);
	}

	/** Responsibilities: _proxy lambda forwarding_. **/
	public proxy_lambda(node: ts.Node): boolean {
		if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) {
			return false;
		}
		if (!this.proxy_lambda_target(node)) {
			return false;
		}
		return this.proxy_callable(node);
	}
}
