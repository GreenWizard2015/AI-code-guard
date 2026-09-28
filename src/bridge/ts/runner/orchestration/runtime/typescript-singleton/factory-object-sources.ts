import ts from 'typescript';
import { TypeScriptExpressionNames } from 'src/typescript-aliases/typescript-expression-names';

/** Responsibilities: _factory object source registry_. **/
export class TypeScriptFactoryObjectSources {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly source_file: ts.SourceFile;
	private readonly sources = new Map<string, ts.ObjectLiteralExpression>();

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
		visit(this.source_file);
		return declarations;
	}

	/** Responsibilities: _object source registration_. **/
	private append_literal(name: string, source: ts.ObjectLiteralExpression): boolean {
		if (this.sources.has(name)) {
			return false;
		}
		this.sources.set(name, source);
		return true;
	}

	/** Responsibilities: _object source alias_. **/
	private append_alias(name: string, alias: string): boolean {
		if (this.sources.has(name)) {
			return false;
		}
		const source = this.sources.get(alias);
		if (source === undefined) {
			return false;
		}
		this.sources.set(name, source);
		return true;
	}

	/** Responsibilities: _object source declaration_. **/
	private append_declaration(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const initializer = this.expression_names.unwrap_transparent_expression(declaration.initializer);
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
		this.source_file = source_file;
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
		return this.sources;
	}

	/** Responsibilities: _object source dispatch_. **/
	public append(
		expression: ts.Expression,
		visitor: (source: ts.ObjectLiteralExpression) => void,
	): void {
		this.register();
		const source = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isObjectLiteralExpression(source)) {
			visitor(source);
			return;
		}
		if (ts.isIdentifier(source)) {
			const object_source = this.sources.get(source.text);
			if (object_source !== undefined) {
				visitor(object_source);
			}
		}
	}
}
