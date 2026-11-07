import { BUILTIN_CONSTRUCTORS } from "src/constants";
import { TypeScriptClassAliases } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_class_aliases";
import { TypeScriptFactoryInstances } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_instances";
import { ImportedNames } from "src/linting/orchestration/runtime/typescript-singleton/imported_names";
import { TypeScriptFactoryAliases } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { ImportedNamesContract } from "src/shared_services_protocols";
import type {
	TypeScriptClassAliasesContract,
	TypeScriptSingletonExpressionsContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _constructor values_, _factory results_. **/
export class TypeScriptSingletonExpressions implements TypeScriptSingletonExpressionsContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _imported_names: ImportedNamesContract;
	private readonly _class_aliases: TypeScriptClassAliasesContract;
	private readonly _factory_instances: TypeScriptFactoryInstances;

	/** Responsibilities: _nested instance identification_. **/
	private contains_instance(expression: ts.Expression): boolean {
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (ts.isFunctionLike(node)) {
				return;
			}
			if (ts.isNewExpression(node)) {
				if (this.local_new(node)) {
					found = true;
					return;
				}
			}
			if (ts.isCallExpression(node)) {
				if (this._factory_instances.local_factory(node)) {
					found = true;
					return;
				}
			}
			ts.forEachChild(node, visit);
		};
		ts.forEachChild(expression, visit);
		return found;
	}

	/** Responsibilities: _local constructor identification_. **/
	private local_new(initializer: ts.NewExpression): boolean {
		const expression = this._expression_names.unwrap_transparent_expression(initializer.expression);
		if (ts.isClassExpression(expression)) {
			return true;
		}
		if (ts.isIdentifier(expression)) {
			return this.project_constructor(expression.text);
		}
		return this._class_aliases.access(expression);
	}

	/** Responsibilities: _project constructor identification_. **/
	private project_constructor(name: string): boolean {
		if (BUILTIN_CONSTRUCTORS.has(name)) {
			return false;
		}
		if (this._class_aliases.names().has(name)) {
			return true;
		}
		return this._imported_names.name(name);
	}

	/** Responsibilities: _singleton expression matcher initialization_. **/
	public constructor(source_file: ts.SourceFile, local_class_names: ReadonlySet<string>) {
		this._expression_names = new TypeScriptExpressionNames();
		this._imported_names = new ImportedNames(source_file);
		this._class_aliases = new TypeScriptClassAliases(source_file, local_class_names);
		const factory_aliases = new TypeScriptFactoryAliases(source_file);
		this._factory_instances = new TypeScriptFactoryInstances(
			source_file,
			this._expression_names,
			this._class_aliases,
			factory_aliases,
		);
	}

	/** Responsibilities: _singleton initializer identification_. **/
	public initializer(expression: ts.Expression): boolean {
		if (ts.isNewExpression(expression)) {
			if (this.local_new(expression)) {
				return true;
			}
		}
		if (ts.isCallExpression(expression)) {
			if (this._factory_instances.local_factory(expression)) {
				return true;
			}
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
