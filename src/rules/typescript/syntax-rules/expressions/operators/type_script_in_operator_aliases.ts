import { TypeScriptBindingAliases } from "src/parser/typescript-aliases/type_script_binding_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { DynamicBindingNamesContract } from "src/shared_services_protocols";
import type { TypeScriptMembershipAliasScope } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _membership operand alias tracking_, _scope-aware alias resolution_. **/
export class TypeScriptInOperatorAliases {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _binding_aliases: TypeScriptBindingAliases;
	private readonly _binding_names: DynamicBindingNamesContract;

	/** Responsibilities: _collection declarations_. **/
	private collect_declarations(node: ts.Node, declarations: ts.VariableDeclaration[], root: ts.Node): void {
		const is_nested_node = node !== root;
		if (is_nested_node && ts.isFunctionLike(node)) {
			return;
		}
		if (ts.isVariableDeclaration(node)) {
			declarations.push(node);
		}
		ts.forEachChild(node, (child) => this.collect_declarations(child, declarations, root));
	}

	/** Responsibilities: _membership alias addition_. **/
	private add_name(names: Set<string>, name: string): boolean {
		if (names.has(name)) {
			return false;
		}
		names.add(name);
		return true;
	}

	/** Responsibilities: _direct membership alias_. **/
	private append_direct_alias(
		membership_declaration: ts.VariableDeclaration,
		membership_scope: TypeScriptMembershipAliasScope,
	): boolean {
		const missing_initializer = membership_declaration.initializer === undefined;
		if (!ts.isIdentifier(membership_declaration.name) || missing_initializer) {
			return false;
		}
		const alias_name = membership_declaration.name.text;
		if (!this.invalid(membership_declaration.initializer, membership_scope.source_file)) {
			return false;
		}
		return this.add_name(membership_scope.names, alias_name);
	}

	/** Responsibilities: _chained membership alias_. **/
	private append_chained_alias(
		chained_declaration: ts.VariableDeclaration,
		chained_scope: TypeScriptMembershipAliasScope,
	): boolean {
		const missing_initializer = chained_declaration.initializer === undefined;
		if (!ts.isIdentifier(chained_declaration.name) || missing_initializer) {
			return false;
		}
		const initializer = chained_declaration.initializer;
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		if (!chained_scope.names.has(initializer.text)) {
			return false;
		}
		return this.add_name(chained_scope.names, chained_declaration.name.text);
	}

	/** Responsibilities: _destructured membership aliases_. **/
	private append_pattern_alias(
		pattern_declaration: ts.VariableDeclaration,
		pattern_scope: TypeScriptMembershipAliasScope,
	): boolean {
		const missing_initializer = pattern_declaration.initializer === undefined;
		if (missing_initializer || ts.isIdentifier(pattern_declaration.name)) {
			return false;
		}
		return this._binding_aliases.append_binding_aliases(
			new Set<string>(),
			pattern_declaration.name,
			pattern_declaration.initializer,
			(expression) => this.object_value(expression, pattern_scope),
			(name, initializer) => {
				if (this.invalid(initializer, pattern_scope.source_file)) {
					return this.add_name(pattern_scope.names, name);
				}
				if (!ts.isIdentifier(initializer) || !pattern_scope.names.has(initializer.text)) {
					return false;
				}
				return this.add_name(pattern_scope.names, name);
			},
		);
	}

	/** Responsibilities: _object alias value_. **/
	private object_value(expression: ts.Expression, object_scope: TypeScriptMembershipAliasScope): ts.Expression {
		const seen = new Set<string>();
		let value = expression;
		while (ts.isIdentifier(value) && !seen.has(value.text)) {
			const object_value = object_scope.object_aliases.get(value.text);
			if (object_value === undefined) {
				break;
			}
			seen.add(value.text);
			value = object_value;
		}
		return value;
	}

	/** Responsibilities: _object alias addition_. **/
	private append_object_alias(
		object_declaration: ts.VariableDeclaration,
		object_scope: TypeScriptMembershipAliasScope,
	): boolean {
		const missing_initializer = object_declaration.initializer === undefined;
		if (!ts.isIdentifier(object_declaration.name) || missing_initializer) {
			return false;
		}
		const value = this.object_value(object_declaration.initializer, object_scope);
		if (!ts.isObjectLiteralExpression(value) || object_scope.object_aliases.has(object_declaration.name.text)) {
			return false;
		}
		object_scope.object_aliases.set(object_declaration.name.text, value);
		return true;
	}

	/** Responsibilities: _membership alias extension_. **/
	private append_alias(
		alias_declaration: ts.VariableDeclaration,
		alias_scope: TypeScriptMembershipAliasScope,
	): boolean {
		if (this.append_direct_alias(alias_declaration, alias_scope)) {
			return true;
		}
		if (this.append_chained_alias(alias_declaration, alias_scope)) {
			return true;
		}
		return this.append_pattern_alias(alias_declaration, alias_scope);
	}

	/** Responsibilities: _membership alias resolution_. **/
	private resolve(declarations: ts.VariableDeclaration[], resolution_file: ts.SourceFile): ReadonlySet<string> {
		const scope: TypeScriptMembershipAliasScope = {
			names: new Set<string>(),
			object_aliases: new Map<string, ts.ObjectLiteralExpression>(),
			source_file: resolution_file,
		};
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.append_object_alias(declaration, scope)) {
					changed = true;
				}
				if (this.append_alias(declaration, scope)) {
					changed = true;
				}
			}
		}
		return scope.names;
	}

	/** Responsibilities: _scope membership aliases_. **/
	private collect(lexical_scope_node: ts.Node, enclosing_file: ts.SourceFile): ReadonlySet<string> {
		const declarations: ts.VariableDeclaration[] = [];
		this.collect_declarations(lexical_scope_node, declarations, lexical_scope_node);
		return this.resolve(declarations, enclosing_file);
	}

	/** Responsibilities: _resolver initialization_. **/
	public constructor(binding_names: DynamicBindingNamesContract) {
		this._expression_names = new TypeScriptExpressionNames();
		this._binding_aliases = new TypeScriptBindingAliases(this._expression_names);
		this._binding_names = binding_names;
	}

	/** Responsibilities: _classification invalid membership_. **/
	public invalid(expression: ts.Expression, membership_file: ts.SourceFile): boolean {
		if (!ts.isBinaryExpression(expression)) {
			return false;
		}
		if (expression.operatorToken.kind !== ts.SyntaxKind.InKeyword) {
			return false;
		}
		return !this._binding_names.collection(expression.right, membership_file);
	}

	/** Responsibilities: _membership alias names_. **/
	public aliases(membership_node: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		const source_file = membership_node.getSourceFile();
		let current = membership_node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				for (const name of this.collect(current, source_file)) {
					names.add(name);
				}
			}
			current = current.parent;
		}
		for (const name of this.collect(current, source_file)) {
			names.add(name);
		}
		return names;
	}
}
