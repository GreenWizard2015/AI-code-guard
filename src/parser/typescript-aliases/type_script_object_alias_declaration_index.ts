import { TypeScriptVariableDeclarationScope } from "src/parser/typescript-aliases/type_script_variable_declaration_scope";
import type {
	CallableTypeScriptObjectAliasDeclarationAppender,
	TypeScriptExpressionNormalizerContract,
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptVariableDeclarationScopeContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _scope declaration inventory_, _AST-scoped declaration reuse_. **/
export class TypeScriptObjectAliasDeclarationIndex implements TypeScriptObjectAliasDeclarationIndexContract {
	private readonly _declarations_by_scope: WeakMap<ts.Node, readonly ts.Node[]>;
	private readonly _variable_scopes: WeakMap<ts.Node, TypeScriptVariableDeclarationScopeContract>;
	private readonly _normalized_expressions: WeakMap<ts.Expression, ts.Expression>;

	/** Responsibilities: _scope declaration collection_. **/
	private collect_declarations(root: ts.Node, declarations: ts.Node[]): void {
		const visit = (node: ts.Node): void => {
			if (node !== root && ts.isFunctionLike(node)) {
				return;
			}
			if (ts.isVariableDeclaration(node)) {
				if (node.initializer !== undefined) {
					declarations.push(node);
				}
			} else if (ts.isBinaryExpression(node)) {
				if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
					declarations.push(node);
				}
			}
			node.forEachChild(visit);
		};
		visit(root);
	}

	/** Responsibilities: _declaration index initialization_. **/
	public constructor() {
		this._declarations_by_scope = new WeakMap();
		this._variable_scopes = new WeakMap();
		this._normalized_expressions = new WeakMap();
	}

	/** Responsibilities: _shared transparent expression normalization_. **/
	public normalize_expression(
		expression: ts.Expression,
		normalizer: TypeScriptExpressionNormalizerContract,
	): ts.Expression {
		const cached = this._normalized_expressions.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		const normalized = normalizer.normalize_uncached(expression);
		if (normalized !== expression) {
			this._normalized_expressions.set(expression, normalized);
		}
		return normalized;
	}

	/** Responsibilities: _cached expression normalization lookup_. **/
	public cached_normal_form(expression: ts.Expression): ts.Expression {
		const cached = this._normalized_expressions.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		return expression;
	}

	/** Responsibilities: _variable declaration scope lookup_. **/
	public variable_scope(ast_scope: ts.Node): TypeScriptVariableDeclarationScopeContract {
		const cached = this._variable_scopes.get(ast_scope);
		if (cached !== undefined) {
			return cached;
		}
		const variable_scope = new TypeScriptVariableDeclarationScope(ast_scope);
		this._variable_scopes.set(ast_scope, variable_scope);
		return variable_scope;
	}

	/** Responsibilities: _scope declaration lookup_. **/
	public declarations(scope: ts.Node): readonly ts.Node[] {
		const cached = this._declarations_by_scope.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const declarations: ts.Node[] = [];
		this.collect_declarations(scope, declarations);
		this._declarations_by_scope.set(scope, declarations);
		return declarations;
	}

	/** Responsibilities: _scope declaration application_. **/
	public append(scope: ts.Node, append_declaration: CallableTypeScriptObjectAliasDeclarationAppender): boolean {
		let changed = false;
		for (const declaration of this.declarations(scope)) {
			if (append_declaration(declaration)) {
				changed = true;
			}
		}
		return changed;
	}
}
