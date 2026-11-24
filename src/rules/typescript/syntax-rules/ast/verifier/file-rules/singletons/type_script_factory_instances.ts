import { BUILTIN_CONSTRUCTORS } from "src/constants";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptClassAliasesContract,
	TypeScriptFactoryAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory instance lookup_, _class instance classification_. **/
export class TypeScriptFactoryInstances {
	private readonly _source_file: ts.SourceFile;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _class_aliases: TypeScriptClassAliasesContract;
	private readonly _factory_aliases: TypeScriptFactoryAliasesContract;
	private readonly _visited: Set<string>;

	/** Responsibilities: _factory body result_. **/
	private factory_body(expression: ts.Node): boolean {
		if (!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression)) {
			return false;
		}
		if (ts.isBlock(expression.body)) {
			return this.scans_class_instance(expression.body);
		}
		return this.instance_result(expression.body);
	}

	/** Responsibilities: _factory declaration lookup_. **/
	private function_declarations(declaration_name: string): ts.FunctionDeclaration[] {
		const declarations: ts.FunctionDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionDeclaration(node)) {
				const name = node.name;
				if (name !== undefined && name.text === declaration_name) {
					declarations.push(node);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source_file);
		return declarations;
	}

	/** Responsibilities: _recursive factory chain result_. **/
	private chained_result(alias_name: string): boolean {
		for (const source of this._factory_aliases.sources(alias_name)) {
			if (this.returns_class_instance(source)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _factory declaration lookup_, _factory alias traversal_. **/
	private declared_result(factory_name: string): boolean {
		for (const declaration of this.function_declarations(factory_name)) {
			if (declaration.body !== undefined && this.scans_class_instance(declaration.body)) {
				return true;
			}
		}
		for (const body of this._factory_aliases.inline_bodies(factory_name)) {
			if (this.factory_body(body)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _class instance factory resolution_. **/
	private returns_class_instance(factory_name: string): boolean {
		if (this._visited.has(factory_name)) {
			return false;
		}
		this._visited.add(factory_name);
		if (!this._factory_aliases.names().has(factory_name)) {
			return false;
		}
		return this.declared_result(factory_name) || this.chained_result(factory_name);
	}

	/** Responsibilities: _factory body instance scan_. **/
	private scans_class_instance(body: ts.Block): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (this.instance_result(node)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		ts.forEachChild(body, visit);
		return found;
	}

	/** Responsibilities: _class instance expression identification_. **/
	private instance_result(node: ts.Node): boolean {
		if (ts.isNewExpression(node)) {
			const expression = this._expression_names.unwrap_transparent_expression(node.expression);
			if (ts.isClassExpression(expression)) {
				return true;
			}
			if (!ts.isIdentifier(expression) || BUILTIN_CONSTRUCTORS.has(expression.text)) {
				return false;
			}
			return this._class_aliases.name(expression.text);
		}
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			return this.returns_class_instance(node.expression.text);
		}
		return false;
	}

	/** Responsibilities: _factory instance lookup setup_. **/
	public constructor(
		source_file: ts.SourceFile,
		expression_names: ExpressionNamesContract,
		class_aliases: TypeScriptClassAliasesContract,
		factory_aliases: TypeScriptFactoryAliasesContract,
	) {
		this._source_file = source_file;
		this._expression_names = expression_names;
		this._class_aliases = class_aliases;
		this._factory_aliases = factory_aliases;
		this._visited = new Set<string>();
	}

	/** Responsibilities: _factory lookup state reset_. **/
	public reset(): void {
		this._visited.clear();
	}

	/** Responsibilities: _local factory result_. **/
	public local_factory(initializer: ts.Expression): boolean {
		if (!ts.isCallExpression(initializer)) {
			return false;
		}
		if (ts.isIdentifier(initializer.expression)) {
			this.reset();
			return this.returns_class_instance(initializer.expression.text);
		}
		for (const body of this._factory_aliases.property_bodies(initializer.expression)) {
			if (this.factory_body(body)) {
				return true;
			}
		}
		return this.factory_body(initializer.expression);
	}
}
