import ts from "typescript";
import { TypeScriptBindingAliases } from "src/typescript-aliases/typescript-binding-aliases";
import type { DynamicBindingNamesProtocol } from "src/protocols";

/** Responsibilities: _TypeScript membership alias resolution_. **/
export class TypeScriptInOperatorAliases {
	private readonly binding_aliases = new TypeScriptBindingAliases();
	private readonly binding_names: DynamicBindingNamesProtocol;

	/** Responsibilities: _collection declarations_. **/
	private collect_declarations(node: ts.Node, declarations: ts.VariableDeclaration[], root: ts.Node): void {
		if (node !== root && ts.isFunctionLike(node)) {
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
		declaration: ts.VariableDeclaration,
		source_file: ts.SourceFile,
		names: Set<string>,
	): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const alias_name = declaration.name.text;
		if (!this.invalid(declaration.initializer, source_file)) {
			return false;
		}
		return this.add_name(names, alias_name);
	}

	/** Responsibilities: _chained membership alias_. **/
	private append_chained_alias(declaration: ts.VariableDeclaration, names: Set<string>): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const initializer = declaration.initializer;
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		if (!names.has(initializer.text)) {
			return false;
		}
		return this.add_name(names, declaration.name.text);
	}

	/** Responsibilities: _destructured membership aliases_. **/
	private append_pattern_alias(
		declaration: ts.VariableDeclaration,
		source_file: ts.SourceFile,
		names: Set<string>,
		object_aliases: ReadonlyMap<string, ts.ObjectLiteralExpression>,
	): boolean {
		if (declaration.initializer === undefined || ts.isIdentifier(declaration.name)) {
			return false;
		}
		return this.binding_aliases.append_binding_aliases(
			new Set<string>(),
			declaration.name,
			declaration.initializer,
			(expression) => this.object_value(expression, object_aliases),
			(name, initializer) => {
				if (this.invalid(initializer, source_file)) {
					return this.add_name(names, name);
				}
				if (!ts.isIdentifier(initializer) || !names.has(initializer.text)) {
					return false;
				}
				return this.add_name(names, name);
			},
		);
	}

	/** Responsibilities: _object alias value_. **/
	private object_value(
		expression: ts.Expression,
		object_aliases: ReadonlyMap<string, ts.ObjectLiteralExpression>,
	): ts.Expression {
		const seen = new Set<string>();
		let value = expression;
		while (ts.isIdentifier(value) && !seen.has(value.text)) {
			const object_value = object_aliases.get(value.text);
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
		declaration: ts.VariableDeclaration,
		object_aliases: Map<string, ts.ObjectLiteralExpression>,
	): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const value = this.object_value(declaration.initializer, object_aliases);
		if (!ts.isObjectLiteralExpression(value) || object_aliases.has(declaration.name.text)) {
			return false;
		}
		object_aliases.set(declaration.name.text, value);
		return true;
	}

	/** Responsibilities: _membership alias extension_. **/
	private append_alias(
		declaration: ts.VariableDeclaration,
		source_file: ts.SourceFile,
		names: Set<string>,
		object_aliases: ReadonlyMap<string, ts.ObjectLiteralExpression>,
	): boolean {
		if (this.append_direct_alias(declaration, source_file, names)) {
			return true;
		}
		if (this.append_chained_alias(declaration, names)) {
			return true;
		}
		return this.append_pattern_alias(declaration, source_file, names, object_aliases);
	}

	/** Responsibilities: _membership alias resolution_. **/
	private resolve(declarations: ts.VariableDeclaration[], source_file: ts.SourceFile): ReadonlySet<string> {
		const names = new Set<string>();
		const object_aliases = new Map<string, ts.ObjectLiteralExpression>();
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.append_object_alias(declaration, object_aliases)) {
					changed = true;
				}
				if (this.append_alias(declaration, source_file, names, object_aliases)) {
					changed = true;
				}
			}
		}
		return names;
	}

	/** Responsibilities: _scope membership aliases_. **/
	private collect(scope: ts.Node, source_file: ts.SourceFile): ReadonlySet<string> {
		const declarations: ts.VariableDeclaration[] = [];
		this.collect_declarations(scope, declarations, scope);
		return this.resolve(declarations, source_file);
	}

	/** Responsibilities: _resolver initialization_. **/
	public constructor(binding_names: DynamicBindingNamesProtocol) {
		this.binding_names = binding_names;
	}

	/** Responsibilities: _classification invalid membership_. **/
	public invalid(expression: ts.Expression, source_file: ts.SourceFile): boolean {
		if (!ts.isBinaryExpression(expression)) {
			return false;
		}
		if (expression.operatorToken.kind !== ts.SyntaxKind.InKeyword) {
			return false;
		}
		return !this.binding_names.collection(expression.right, source_file);
	}

	/** Responsibilities: _membership alias names_. **/
	public aliases(node: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		const source_file = node.getSourceFile();
		let current = node;
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
