import type { CallableObjectSourceVisitor } from "src/analysis_types";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptFactoryObjectSourcesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object source registration_, _source alias traversal_. **/
export class TypeScriptFactoryObjectSources implements TypeScriptFactoryObjectSourcesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _source_file: ts.SourceFile;
	private readonly _sources: Map<string, ts.ObjectLiteralExpression>;

	/** Responsibilities: _module variable collection_. **/
	private variable_declarations(): readonly ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
				return;
			}
			if (ts.isVariableDeclaration(node)) {
				declarations.push(node);
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source_file);
		return declarations;
	}

	/** Responsibilities: _object source registration_. **/
	private append_literal(name: string, source: ts.ObjectLiteralExpression): boolean {
		if (this._sources.has(name)) {
			return false;
		}
		this._sources.set(name, source);
		return true;
	}

	/** Responsibilities: _object source alias_. **/
	private append_alias(name: string, alias: string): boolean {
		if (this._sources.has(name)) {
			return false;
		}
		const source = this._sources.get(alias);
		if (source === undefined) {
			return false;
		}
		this._sources.set(name, source);
		return true;
	}

	/** Responsibilities: _object source declaration_. **/
	private append_declaration(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		const initializer = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isObjectLiteralExpression(initializer)) {
			return this.append_literal(declaration.name.text, initializer);
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		return this.append_alias(declaration.name.text, initializer.text);
	}

	/** Responsibilities: _registry state_. **/
	public constructor(source_file: ts.SourceFile) {
		this._expression_names = new TypeScriptExpressionNames();
		this._sources = new Map<string, ts.ObjectLiteralExpression>();
		this._source_file = source_file;
	}

	/** Responsibilities: _object source registration_. **/
	public register(): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of this.variable_declarations()) {
				if (this.append_declaration(declaration)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _object source values_. **/
	public values(): Map<string, ts.ObjectLiteralExpression> {
		this.register();
		return this._sources;
	}

	/** Responsibilities: _object source dispatch_. **/
	public append(expression: ts.Expression, visitor: CallableObjectSourceVisitor): void {
		this.register();
		const source = this._expression_names.unwrap_transparent_expression(expression);
		if (ts.isObjectLiteralExpression(source)) {
			visitor(source);
			return;
		}
		if (ts.isIdentifier(source)) {
			const object_source = this._sources.get(source.text);
			if (object_source !== undefined) {
				visitor(object_source);
			}
		}
	}
}
