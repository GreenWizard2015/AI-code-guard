import ts from 'typescript';
import { ImportedNames } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/imported-names';
import { TypeScriptClassAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/class-aliases';
import { TypeScriptFactoryAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-aliases';
import { BUILTIN_CONSTRUCTORS } from 'src/bridge/ts/runner/orchestration/runtime/constants';
import { unwrap_transparent_expression } from 'functions';

/** Responsibilities: _TypeScript singleton expression matching_. **/
export class TypeScriptSingletonExpressions {
	private readonly source_file: ts.SourceFile;
	private readonly imported_names: ImportedNames;
	private readonly class_aliases: TypeScriptClassAliases;
	private readonly factory_aliases: TypeScriptFactoryAliases;
	private readonly visited = new Set<string>();

	/** Responsibilities: _direct instance identification_. **/
	private direct_instance(expression: ts.Expression): boolean {
		if (ts.isNewExpression(expression)) {
			return this.local_new(expression);
		}
		if (ts.isCallExpression(expression)) {
			return this.local_factory(expression);
		}
		return false;
	}

	/** Responsibilities: _nested instance identification_. **/
	private contains_instance(expression: ts.Expression): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found || ts.isFunctionLike(node)) {
				return;
			}
			if (ts.isNewExpression(node) && this.local_new(node)) {
				found = true;
				return;
			}
			if (ts.isCallExpression(node) && this.local_factory(node)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		ts.forEachChild(expression, visit);
		return found;
	}

	/** Responsibilities: _local constructor identification_. **/
	private local_new(initializer: ts.NewExpression): boolean {
		const expression = unwrap_transparent_expression(initializer.expression);
		if (ts.isClassExpression(expression)) {
			return true;
		}
		if (ts.isIdentifier(expression)) {
			return this.project_constructor(expression.text);
		}
		return this.class_aliases.access(expression);
	}

	/** Responsibilities: _project constructor identification_. **/
	private project_constructor(name: string): boolean {
		if (BUILTIN_CONSTRUCTORS.has(name)) {
			return false;
		}
		if (this.class_aliases.names().has(name)) {
			return true;
		}
		return this.imported_names.name(name);
	}

	/** Responsibilities: _local factory identification_. **/
	private local_factory(initializer: ts.Expression): boolean {
		if (!ts.isCallExpression(initializer)) {
			return false;
		}
		if (ts.isIdentifier(initializer.expression)) {
			this.visited.clear();
			return this.returns_class_instance(initializer.expression.text);
		}
		for (const body of this.factory_aliases.property_bodies(initializer.expression)) {
			if (this.factory_body(body)) {
				return true;
			}
		}
		return this.factory_body(initializer.expression);
	}

	/** Responsibilities: _inline factory body identification_. **/
	private factory_body(expression: ts.Node): boolean {
		if (!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression)) {
			return false;
		}
		if (ts.isBlock(expression.body)) {
			return this.scans_class_instance(expression.body);
		}
		return this.instance_result(expression.body);
	}

	/** Responsibilities: _factory instance resolution_. **/
	private returns_class_instance(name: string): boolean {
		if (this.visited.has(name)) {
			return false;
		}
		this.visited.add(name);
		if (!this.factory_aliases.names().has(name)) {
			return false;
		}
		if (this.declared_factory_instance(name)) {
			return true;
		}
		if (this.inline_factory_instance(name)) {
			return true;
		}
		return this.aliased_factory_instance(name);
	}

	/** Responsibilities: _declared factory instance resolution_. **/
	private declared_factory_instance(name: string): boolean {
		for (const declaration of this.factory_declarations(name)) {
			if (declaration.body !== undefined) {
				if (this.scans_class_instance(declaration.body)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _inline factory instance resolution_. **/
	private inline_factory_instance(name: string): boolean {
		for (const body of this.factory_aliases.inline_bodies(name)) {
			if (this.factory_body(body)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _aliased factory instance resolution_. **/
	private aliased_factory_instance(name: string): boolean {
		for (const source of this.factory_aliases.sources(name)) {
			if (this.returns_class_instance(source)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _factory declaration collection_. **/
	private factory_declarations(name: string): readonly ts.FunctionDeclaration[] {
		const declarations: ts.FunctionDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionDeclaration(node)) {
				if (node.name !== undefined) {
					if (node.name.text === name) {
						declarations.push(node);
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(this.source_file);
		return declarations;
	}

	/** Responsibilities: _factory body scanning_. **/
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

	/** Responsibilities: _class-instance expression identification_. **/
	private instance_result(node: ts.Node): boolean {
		if (ts.isNewExpression(node)) {
			const expression = unwrap_transparent_expression(node.expression);
			if (ts.isClassExpression(expression)) {
				return true;
			}
			if (!ts.isIdentifier(expression)) {
				return false;
			}
			if (BUILTIN_CONSTRUCTORS.has(expression.text)) {
				return false;
			}
			return this.class_aliases.name(expression.text);
		}
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			return this.returns_class_instance(node.expression.text);
		}
		return false;
	}

	/** Responsibilities: _singleton expression matcher initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		local_class_names: ReadonlySet<string>,
	) {
		this.source_file = source_file;
		this.imported_names = new ImportedNames(this.source_file);
		this.class_aliases = new TypeScriptClassAliases(source_file, local_class_names);
		this.factory_aliases = new TypeScriptFactoryAliases(source_file);
	}

	/** Responsibilities: _singleton initializer identification_. **/
	public initializer(expression: ts.Expression): boolean {
		if (this.direct_instance(expression)) {
			return true;
		}
		return this.contains_instance(expression);
	}

	/** Responsibilities: _variable singleton matching_. **/
	public variable(declaration: ts.VariableDeclaration): boolean {
		if (declaration.initializer === undefined) {
			return false;
		}
		return this.initializer(declaration.initializer);
	}

}
