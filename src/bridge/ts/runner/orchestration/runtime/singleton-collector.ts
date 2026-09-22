import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import ts from 'typescript';

import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { AstModuleInstance, NormalizedAstFile } from 'src/types';
import { ImportedNames } from 'src/bridge/ts/runner/orchestration/runtime/imported-names';
import { BUILTIN_CONSTRUCTORS } from 'src/bridge/ts/runner/orchestration/runtime/constants';

/** Responsibilities: _detection singleton instances inspection_. **/
export class SingletonCollector {
	private readonly source_file: ts.SourceFile;

	private readonly normalized_ast: NormalizedAstFile;

	private readonly local_class_names: ReadonlySet<string>;

	private readonly imported_names: ImportedNames;

	private readonly visited = new Set<string>();

	private readonly file: string;

	private readonly text: string;

	private readonly python_ast_parser = new PythonAstData();

	/** Responsibilities: _Python singleton violations collection_. **/
	private python(): Violation[] {
		const instances = this.python_instances();
		if (instances.length === 0) {
			return [];
		}
		return this.python_violations(instances);
	}

	/** Responsibilities: _Python module instances collection_. **/
	private python_instances(): AstModuleInstance[] {
		let ast = this.normalized_ast;
		if (!ast) {
			ast = this.python_ast_parser.source_ast(this.text);
		}
		if (!ast.module_instances) {
			return [];
		}
		return ast.module_instances
			.filter(instance => /^[A-Z]\w*$/u.test(instance.constructor))
			.filter(instance => this.local_class_names.has(instance.constructor))
			.filter(instance => !BUILTIN_CONSTRUCTORS.has(instance.constructor));
	}

	/** Responsibilities: _Python singleton violations construction_. **/
	private python_violations(instances: AstModuleInstance[]): Violation[] {
		const violations: Violation[] = [];
		for (const instance of instances) {
			const rule = new DiagnosticRule('singleton');
			violations.push(rule.violation(this.file, instance.line + 1));
		}
		return violations;
	}

	/** Responsibilities: _inspection TypeScript variable declaration_. **/
	private declaration(declaration: ts.VariableDeclaration): Violation[] {
		const initializer = declaration.initializer;
		if (!initializer) {
			return [];
		}
		if (!this.is_singleton_initializer(initializer)) {
			return [];
		}
		const line = this.source_file.getLineAndCharacterOfPosition(
			declaration.getStart(this.source_file)
		).line;
		const rule = new DiagnosticRule('singleton');
		return [rule.violation(this.file, line + 1)];
	}

	/** Responsibilities: _singleton initializers identification_. **/
	private is_singleton_initializer(initializer: ts.Expression): boolean {
		if (ts.isNewExpression(initializer)) {
			return this.is_local_new(initializer);
		}
		return this.is_local_factory(initializer);
	}

	/** Responsibilities: _local constructor initializers identification_. **/
	private is_local_new(initializer: ts.NewExpression): boolean {
		const expression = initializer.expression;
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.is_project_constructor(expression.text);
	}

	/** Responsibilities: _constructors identification projection_. **/
	private is_project_constructor(name: string): boolean {
		if (BUILTIN_CONSTRUCTORS.has(name)) {
			return false;
		}
		if (this.local_class_names.has(name)) {
			return true;
		}
		return this.imported_names.name(name);
	}

	/** Responsibilities: _local factory initializers identification_. **/
	private is_local_factory(initializer: ts.Expression): boolean {
		if (!ts.isCallExpression(initializer)) {
			return false;
		}
		if (initializer.arguments.length > 0) {
			return false;
		}
		if (!ts.isIdentifier(initializer.expression)) {
			return false;
		}
		this.visited.clear();
		return this.returns_class_instance(initializer.expression.text);
	}

	/** Responsibilities: _identification factory functions output_. **/
	private returns_class_instance(name: string): boolean {
		if (this.visited.has(name)) {
			return false;
		}
		this.visited.add(name);
		const declaration = this.source_file.statements.find(
			statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name
		);
		if (declaration === undefined || (!ts.isFunctionDeclaration(declaration)) || (!declaration.body)) {
			return false;
		}
		return this.scans_class_instance(declaration.body);
	}

	/** Responsibilities: _function body class scanning_. **/
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
			if (ts.isIdentifier(node.expression)) {
				return this.local_class_names.has(node.expression.text);
			}
		}
		if (ts.isCallExpression(node)) {
			if (ts.isIdentifier(node.expression)) {
				return this.returns_class_instance(node.expression.text);
			}
		}
		return false;
	}

	/** Responsibilities: _singleton analysis state initialization_. **/
	constructor(
		file: string,
		text: string,
		local_class_names: ReadonlySet<string>,
		normalized_ast: NormalizedAstFile,
		source_file: ts.SourceFile
	) {
		this.file = file;
		this.text = text;
		this.source_file = source_file;
		this.normalized_ast = normalized_ast;
		this.local_class_names = local_class_names;
		this.imported_names = new ImportedNames(this.source_file);
	}

	/** Responsibilities: _collection singleton violations language_. **/
	public collect_violations(python: boolean): Violation[] {
		if (python) {
			return this.python();
		}
		return this.collect_typescript();
	}

	/** Responsibilities: _TypeScript singleton violations collection_. **/
	public collect_typescript(): Violation[] {
		const declarations = this.source_file.statements.filter(ts.isVariableStatement);
		if (declarations.length === 0) {
			return [];
		}
		return declarations.flatMap(statement => {
			if (!ts.isVariableStatement(statement)) {
				return [];
			}
			return statement.declarationList.declarations.flatMap(declaration =>
				this.declaration(declaration)
			);
		});
	}
}
