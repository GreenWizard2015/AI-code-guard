import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { StaticKeyCollectionState } from "src/model_types";
import type { StaticObjectBindingsContract } from "src/parser/analysis/protocols";
import { TypeScriptStaticArrayAliases } from "src/parser/typescript-aliases/callables/static-key/type_script_static_array_aliases";
import { TypeScriptStaticObjectBindings } from "src/parser/typescript-aliases/callables/static-key/type_script_static_object_bindings";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _scope static key values_, _scope object bindings_. **/
export class TypeScriptStaticKeyState {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _values_by_name: Map<string, string>;
	private readonly _objects_by_name: Map<string, ts.ObjectLiteralExpression>;
	private readonly _arrays_by_name: Map<string, StaticExpressionArrayContract>;
	private readonly _static_key_kinds: Set<ts.SyntaxKind>;
	private readonly _scope: ts.Node;

	/** Responsibilities: _static key value extension_. **/
	private append_value(name: string, initializer: ts.Expression): boolean {
		const current = this._expression_aliases.unwrapped(initializer);
		let value = "";
		if (this._static_key_kinds.has(current.kind)) {
			value = this._expression_names.static_property_name(current);
		} else if (ts.isIdentifier(current)) {
			const resolved_value = this._values_by_name.get(current.text);
			if (resolved_value !== undefined) {
				value = resolved_value;
			}
		}
		if (value.length === 0 || this._values_by_name.has(name)) {
			return false;
		}
		this._values_by_name.set(name, value);
		return true;
	}

	/** Responsibilities: _static key array declaration_. **/
	private append_array_declaration(node: ts.VariableDeclaration): boolean {
		const array_aliases = new TypeScriptStaticArrayAliases(this._values_by_name, this._arrays_by_name);
		if (array_aliases.append_source(node)) {
			return true;
		}
		if (ts.isArrayBindingPattern(node.name)) {
			return array_aliases.append_declaration(node);
		}
		return false;
	}

	/** Responsibilities: _scope state collection_. **/
	private append_node(node: ts.Node, object_bindings: StaticObjectBindingsContract): boolean {
		let changed = this.append_declaration(node, object_bindings);
		if (ts.isBinaryExpression(node)) {
			if (object_bindings.append_assignment(node)) {
				changed = true;
			}
			if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
				changed = this.append_value(node.left.text, node.right) || changed;
			}
		}
		if (node !== this._scope && ts.isFunctionLike(node)) {
			return changed;
		}
		node.forEachChild((child) => {
			if (this.append_node(child, object_bindings)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _scope declaration state update_. **/
	private append_declaration(node: ts.Node, object_bindings: StaticObjectBindingsContract): boolean {
		if (!ts.isVariableDeclaration(node) || node.initializer === undefined) {
			return false;
		}
		if (object_bindings.append(this._values_by_name, this._objects_by_name, node)) {
			return true;
		}
		if (this.append_array_declaration(node)) {
			return true;
		}
		return ts.isIdentifier(node.name) && this.append_value(node.name.text, node.initializer);
	}

	/** Responsibilities: _scope state initialization_. **/
	public constructor(scope: ts.Node) {
		this._scope = scope;
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
		this._expression_names = new TypeScriptExpressionNames();
		this._values_by_name = new Map<string, string>();
		this._objects_by_name = new Map<string, ts.ObjectLiteralExpression>();
		this._arrays_by_name = new Map<string, StaticExpressionArrayContract>();
		this._static_key_kinds = new Set([
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.NumericLiteral,
		]);
	}

	/** Responsibilities: _scope static key collection_. **/
	public collect(): StaticKeyCollectionState {
		const object_bindings = new TypeScriptStaticObjectBindings();
		let changed = true;
		while (changed) {
			changed = this.append_node(this._scope, object_bindings);
		}
		return { values: this._values_by_name, objects: this._objects_by_name };
	}

	/** Responsibilities: _scope static key values_. **/
	public values(): ReadonlyMap<string, string> {
		return this.collect().values;
	}
}
