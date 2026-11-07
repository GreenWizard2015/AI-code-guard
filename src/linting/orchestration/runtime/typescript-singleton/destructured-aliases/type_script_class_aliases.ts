import { TypeScriptArrayDestructuredAliases } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_array_destructured_aliases";
import { TypeScriptClassAliasDeclarationCollector } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_class_alias_declaration_collector";
import { TypeScriptDestructuredAliases } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_destructured_aliases";
import { TypeScriptNamespaceAliases } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_namespace_aliases";
import { ImportedNames } from "src/linting/orchestration/runtime/typescript-singleton/imported_names";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { ImportedNamesContract } from "src/shared_services_protocols";
import type {
	TypeScriptClassAliasesContract,
	TypeScriptNamespaceAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _class alias collection_, _alias access resolution_. **/
export class TypeScriptClassAliases implements TypeScriptClassAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _source_file: ts.SourceFile;
	private readonly _local_class_names: ReadonlySet<string>;
	private readonly _imported_names: ImportedNamesContract;
	private readonly _namespace_aliases: TypeScriptNamespaceAliasesContract;

	/** Responsibilities: _module variable declaration collection_. **/
	private module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
				return;
			}
			if (ts.isVariableStatement(node)) {
				declarations.push(...node.declarationList.declarations);
				return;
			}
			if (ts.isVariableDeclarationList(node)) {
				declarations.push(...node.declarations);
				return;
			}
			ts.forEachChild(node, visit);
		};
		for (const statement of statements) {
			visit(statement);
		}
		return declarations;
	}

	/** Responsibilities: _singleton alias resolver initialization_. **/
	public constructor(source_file: ts.SourceFile, local_class_names: ReadonlySet<string>) {
		this._expression_names = new TypeScriptExpressionNames();
		this._source_file = source_file;
		this._local_class_names = local_class_names;
		this._imported_names = new ImportedNames(source_file);
		this._namespace_aliases = new TypeScriptNamespaceAliases(source_file);
	}

	/** Responsibilities: _collection class reference aliases_. **/
	public names(): ReadonlySet<string> {
		const names = new Set(this._local_class_names);
		for (const imported of this._imported_names.collect()) {
			names.add(imported);
		}
		const declarations = this.module_variables(this._source_file.statements);
		const destructured_aliases = new TypeScriptDestructuredAliases(names, this._source_file);
		const array_destructured_aliases = new TypeScriptArrayDestructuredAliases(names, this._source_file);
		const collector = new TypeScriptClassAliasDeclarationCollector(
			names,
			this._expression_names,
			this._namespace_aliases,
			destructured_aliases,
			array_destructured_aliases,
		);
		collector.append_aliases(declarations);
		return names;
	}

	/** Responsibilities: _classification project class alias_. **/
	public name(name: string): boolean {
		return this.names().has(name);
	}

	/** Responsibilities: _classification qualified class access_. **/
	public access(expression: ts.Expression): boolean {
		const target = this._namespace_aliases.target(expression);
		return target !== "";
	}
}
