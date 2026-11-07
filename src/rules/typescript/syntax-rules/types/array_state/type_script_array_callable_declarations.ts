import { READONLY_BUILTIN_TYPES, TYPESCRIPT_ARRAY_TYPE_NAME } from "src/metrics/constants";
import { TypeScriptTypeAliases } from "src/parser/typescript-aliases/expressions/type_script_type_aliases";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { SourceFileCallableCache, SourceFileCallableMap } from "src/source_types";
import type { TypeScriptTypeAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable declaration indexing_, _single-item array result classification_. **/
export class TypeScriptArrayCallableDeclarations {
	private readonly _cache: SourceFileCallableCache;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _callable_results: WeakMap<ts.FunctionLikeDeclaration, boolean>;
	private readonly _array_type_names: ReadonlySet<string>;
	private readonly _type_aliases: WeakMap<ts.SourceFile, TypeScriptTypeAliasesContract>;

	/** Responsibilities: _callable declaration traversal_. **/
	private append_node(node: ts.Node, declarations: Map<string, ts.FunctionLikeDeclaration[]>): void {
		if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
			this.append_named(node.name.text, node, declarations);
		}
		if (ts.isClassLike(node)) {
			for (const member of node.members) {
				if (ts.isMethodDeclaration(member) && member.name !== undefined) {
					this.append_named(member.name.getText(), member, declarations);
				}
			}
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			const initializer = node.initializer;
			if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
				this.append_named(node.name.text, initializer, declarations);
			}
		}
		node.forEachChild((child) => this.append_node(child, declarations));
	}

	/** Responsibilities: _named callable insertion_. **/
	private append_named(
		name: string,
		declaration: ts.FunctionLikeDeclaration,
		declarations: Map<string, ts.FunctionLikeDeclaration[]>,
	): void {
		let named = declarations.get(name);
		if (named === undefined) {
			named = [];
			declarations.set(name, named);
		}
		named.push(declaration);
	}

	/** Responsibilities: _array type reference classification_. **/
	private array_type_reference(type_reference: ts.TypeReferenceNode, alias_source: ts.SourceFile): boolean {
		let type_name = type_reference.typeName;
		while (ts.isQualifiedName(type_name)) {
			type_name = type_name.right;
		}
		if (!ts.isIdentifier(type_name)) {
			return false;
		}
		if (this._array_type_names.has(type_name.text)) {
			return true;
		}
		if (type_name.text.endsWith("Array") && READONLY_BUILTIN_TYPES.has(type_name.text)) {
			return true;
		}
		return this.array_type_alias(type_name.text, alias_source);
	}

	/** Responsibilities: _source-scoped array alias resolution_. **/
	private array_type_alias(type_name: string, source_file: ts.SourceFile): boolean {
		let aliases = this._type_aliases.get(source_file);
		if (aliases === undefined) {
			aliases = new TypeScriptTypeAliases();
			aliases.collect(source_file);
			this._type_aliases.set(source_file, aliases);
		}
		const resolved = aliases.resolve(type_name);
		return this.array_type_text(resolved, aliases, new Set<string>());
	}

	/** Responsibilities: _readonly array alias resolution_. **/
	private readonly_array_type(text: string, aliases: TypeScriptTypeAliasesContract, visited: Set<string>): boolean {
		const match = /^Readonly<(.+)>$/u.exec(text);
		if (match === null) {
			return false;
		}
		const wrapped_type = match[1];
		if (wrapped_type === undefined) {
			return false;
		}
		return this.array_type_text(wrapped_type, aliases, visited);
	}

	/** Responsibilities: _nested array type resolution_. **/
	private array_type_text(text: string, aliases: TypeScriptTypeAliasesContract, visited: Set<string>): boolean {
		if (visited.has(text)) {
			return false;
		}
		visited.add(text);
		const normalized = text.replace(/^readonly\s+/u, "");
		if (normalized.endsWith("[]") || normalized.startsWith("Array<") || normalized.startsWith("ReadonlyArray<")) {
			return true;
		}
		if (this.readonly_array_type(normalized, aliases, visited)) {
			return true;
		}
		const resolved = aliases.resolve(normalized);
		return resolved !== normalized && this.array_type_text(resolved, aliases, visited);
	}

	/** Responsibilities: _return expression collection_. **/
	private returned_expressions(body: ts.Block): ts.Expression[] {
		const returns: ts.Expression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isReturnStatement(node)) {
				if (node.expression !== undefined) {
					returns.push(node.expression);
				}
				return;
			}
			if (ts.isFunctionLike(node)) {
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(body);
		return returns;
	}

	/** Responsibilities: _single-item array expression classification_. **/
	private single_item_array(array_result: ts.Expression): boolean {
		const expression = this._expression_names.unwrap_transparent_expression(array_result);
		if (ts.isConditionalExpression(expression)) {
			return this.single_item_array(expression.whenTrue) && this.single_item_array(expression.whenFalse);
		}
		return ts.isArrayLiteralExpression(expression) && expression.elements.length <= 1;
	}

	/** Responsibilities: _array return type classification_. **/
	private returns_array(returning_callable: ts.FunctionLikeDeclaration): boolean {
		const type = returning_callable.type;
		if (type === undefined) {
			return false;
		}
		if (ts.isArrayTypeNode(type)) {
			return true;
		}
		if (ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.ReadonlyKeyword) {
			return ts.isArrayTypeNode(type.type);
		}
		if (!ts.isTypeReferenceNode(type)) {
			return false;
		}
		return this.array_type_reference(type, returning_callable.getSourceFile());
	}

	/** Responsibilities: _single-item callable return classification_. **/
	private returns_single_item(returning_callable: ts.FunctionLikeDeclaration): boolean {
		const body = returning_callable.body;
		if (body === undefined) {
			return false;
		}
		if (!ts.isBlock(body)) {
			return this.single_item_array(body);
		}
		const returns = this.returned_expressions(body);
		return returns.length > 0 && returns.every((expression) => this.single_item_array(expression));
	}

	/** Responsibilities: _callable declaration cache initialization_. **/
	public constructor(expression_names: ExpressionNamesContract) {
		this._cache = new WeakMap<ts.SourceFile, SourceFileCallableMap>();
		this._expression_names = expression_names;
		this._callable_results = new WeakMap<ts.FunctionLikeDeclaration, boolean>();
		this._array_type_names = new Set([TYPESCRIPT_ARRAY_TYPE_NAME]);
		this._type_aliases = new WeakMap<ts.SourceFile, TypeScriptTypeAliasesContract>();
	}

	/** Responsibilities: _callable declaration collection_. **/
	public collect_index(source_file: ts.SourceFile): ReadonlyMap<string, readonly ts.FunctionLikeDeclaration[]> {
		const cached = this._cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const declarations_by_name = new Map<string, ts.FunctionLikeDeclaration[]>();
		this.append_node(source_file, declarations_by_name);
		this._cache.set(source_file, declarations_by_name);
		return declarations_by_name;
	}

	/** Responsibilities: _cached single-item callable classification_. **/
	public single_item_callable(array_callable: ts.FunctionLikeDeclaration): boolean {
		const cached = this._callable_results.get(array_callable);
		if (cached !== undefined) {
			return cached;
		}
		if (!this.returns_array(array_callable)) {
			this._callable_results.set(array_callable, false);
			return false;
		}
		const result = this.returns_single_item(array_callable);
		this._callable_results.set(array_callable, result);
		return result;
	}
}
