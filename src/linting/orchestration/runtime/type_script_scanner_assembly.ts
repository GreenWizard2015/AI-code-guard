import ts from "typescript";
import { AstModel } from "src/core/ast_model";
import { Syntax } from "src/parser/analysis/syntax";
import { TypeScriptScannerRules } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_scanner_rules";
import { TypeScriptScannerClass } from "src/linting/orchestration/runtime/type_script_scanner_class";
import type { NormalizedAstFileContract } from "src/types";
import type { TypeScriptScannerOptionsContract } from "src/model/types/types";
import type { TypeScriptScannerState } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import { TypeScriptScriptRuleSet } from "src/linting/orchestration/runtime/type_script_script_rule_set";
import type { TypeScriptScriptRuleServicesContract } from "src/typescript_analysis_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _import binding resolution_, _scanner violation collection_. **/
export class TypeScriptScannerAssembly {
	private readonly syntax: Syntax;
	private readonly ast_model: AstModel;
	private readonly script_rule_services: TypeScriptScriptRuleServicesContract;
	/** Responsibilities: _import binding addition_. **/
	private append_import_bindings(
		bindings: Set<string>,
		statement: ts.ImportDeclaration,
		options: TypeScriptScannerOptionsContract,
		module_specifier: string,
		include_project: boolean,
	): void {
		const module_path = options.module_resolver.module_symbol(
			options.ast_file.source_file_node().fileName,
			module_specifier,
		);
		const clause = statement.importClause;
		if (clause === undefined) {
			return;
		}
		if (clause.namedBindings !== undefined) {
			this.append_named_bindings(bindings, clause.namedBindings, module_path, options, include_project);
		}
		if (clause.name !== undefined) {
			this.append_default_binding(bindings, clause.name, module_path, options, include_project);
		}
	}

	/** Responsibilities: _default import binding addition_. **/
	private append_default_binding(
		bindings: Set<string>,
		name: ts.Identifier,
		module_path: string,
		options: TypeScriptScannerOptionsContract,
		include_project: boolean,
	): void {
		const is_project = this.project_binding(module_path, "default", options);
		if (is_project === include_project) {
			bindings.add(name.text);
		}
	}

	/** Responsibilities: _named import bindings_. **/
	private append_named_bindings(
		bindings: Set<string>,
		named: ts.NamedImportBindings,
		module_path: string,
		options: TypeScriptScannerOptionsContract,
		include_project: boolean,
	): void {
		if (ts.isNamespaceImport(named)) {
			return;
		}
		for (const element of named.elements) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			const is_project = this.project_binding(module_path, imported_name, options);
			if (is_project === include_project) {
				bindings.add(element.name.text);
			}
		}
	}

	/** Responsibilities: _project import binding classification_. **/
	private project_binding(module_path: string, name: string, options: TypeScriptScannerOptionsContract): boolean {
		if (module_path.length === 0) {
			return false;
		}
		const resolved = options.module_resolver.resolve(module_path, name);
		if (resolved.file.length === 0) {
			return false;
		}
		return options.project_files.has(resolved.file);
	}

	/** Responsibilities: _project import binding collection_. **/
	private project_import_bindings(source_file: ts.SourceFile, options: TypeScriptScannerOptionsContract): ReadonlySet<string> {
		const bindings = new Set<string>();
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			this.append_import_bindings(bindings, statement, options, statement.moduleSpecifier.text, true);
		}
		return bindings;
	}

	/** Responsibilities: _TypeScript scanner state_. **/
	private state(options: TypeScriptScannerOptionsContract): TypeScriptScannerState {
		const ast_file = options.ast_file;
		const ast = this.normalized_ast(options);
		const lines = this.syntax.split_lines(options.text);
		const rules = options.stage_timer.measure(
			"file-analysis.typescript.scanner-state",
			() =>
				new TypeScriptScannerRules({
					file_name: options.file_name,
					project_class_names: options.project_class_names,
					project_type_names: options.project_type_names,
					project_interface_names: options.project_interface_names,
					project_contract_names: options.project_contract_names,
					project_boundary_types: options.project_boundary_types,
					project_boundary_contracts: options.project_boundary_contracts,
					module_resolver: options.module_resolver,
					lines,
					ast_file,
					traversal: options.traversal,
					ast,
					stage_timer: options.stage_timer,
					script_rule_services: this.script_rule_services,
				}),
		);
		return { file_name: options.file_name, ast, rules };
	}

	/** Responsibilities: _AST normalization_. **/
	private normalized_ast(options: TypeScriptScannerOptionsContract): NormalizedAstFileContract {
		const ast = options.ast_file.normalized();
		const project_names = new Set(options.typescript_class_names);
		for (const binding of this.project_import_bindings(options.ast_file.source_file_node(), options)) {
			project_names.add(binding);
		}
		this.ast_model.append_namespace_bases(project_names, options.ast_file.source_file_node(), ast.classes, options);
		this.ast_model.exclude_external_imports(project_names, options.ast_file.source_file_node(), options);
		this.ast_model.mark_external_bases(ast.classes, project_names);
		return ast;
	}

	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.syntax = new Syntax();
		this.ast_model = new AstModel();
		this.script_rule_services = new TypeScriptScriptRuleSet();
	}

	/** Responsibilities: _public operation_. **/
	public scan(options: TypeScriptScannerOptionsContract): ViolationContract[] {
		const scanner = new TypeScriptScannerClass(this.state(options));
		scanner.run();
		const violations: ViolationContract[] = [];
		scanner.append_results(violations);
		return violations;
	}

	/** Responsibilities: _mixed-module rule execution_. **/
	public scan_mixed_module(options: TypeScriptScannerOptionsContract): ViolationContract[] {
		const scanner = new TypeScriptScannerClass(this.state(options));
		scanner.scan_mixed_module();
		const violations: ViolationContract[] = [];
		scanner.append_results(violations);
		return violations;
	}
}
