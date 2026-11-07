import type { ASTVerifierRegistrationContract } from "src/ast_verifier_protocols";
import { TypeScriptLiteralConstantRules } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_literal_constant_rules";
import { TypeScriptModulePlacementRule } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_module_placement_rule";
import { TypeScriptProductionTestImportRule } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_production_test_import_rule";
import { TypeScriptFileAstRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_ast_rules";
import { TypeScriptFileHiddenGlobalRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_hidden_global_rules";
import { TypeScriptFileNamespaceRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_namespace_rules";
import { TypeScriptFileNestedDeclarationRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_nested_declaration_rules";
import { TypeScriptFileParseRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_parse_rules";
import { TypeScriptFilePrivateMemberRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_private_member_rules";
import { TypeScriptFileTopLevelRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_top_level_rules";
import { TypeScriptFileJestRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/type_script_file_jest_rules";
import { TypeScriptProjectCallableUsageRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_callable_usage_rules";
import { TypeScriptProjectClassFieldRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_class_field_rules";
import { TypeScriptProjectCompositionRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_composition_rules";
import { TypeScriptProjectSharedParameterRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_shared_parameter_rules";
import { TypeScriptProjectUnusedSymbols } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_unused_symbols";
import ts from "typescript";

/** Responsibilities: _source-file rule registration_, _project rule registration_. **/
export class TypeScriptProjectAstRegistrations {
	private readonly _registry: ASTVerifierRegistrationContract;

	/** Responsibilities: _file structure rule registration_. **/
	private register_scope_rules(): void {
		this._registry.register(new TypeScriptFileAstRules(), [ts.SyntaxKind.SourceFile]);
		this._registry.register(new TypeScriptFileNamespaceRules(), [ts.SyntaxKind.ModuleDeclaration]);
		this._registry.register(new TypeScriptFileNestedDeclarationRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.EnumDeclaration,
		]);
	}

	/** Responsibilities: _source rule registration_. **/
	private register_source_rules(): void {
		this._registry.register(new TypeScriptFileParseRules(), [
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.VariableStatement,
			ts.SyntaxKind.ImportDeclaration,
		]);
		this._registry.register(new TypeScriptFileHiddenGlobalRules(), [
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.VariableStatement,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.CallExpression,
		]);
		this._registry.register(new TypeScriptFileTopLevelRules(), [ts.SyntaxKind.SourceFile]);
	}

	/** Responsibilities: _file access rules_, _test and literal rules_. **/
	private register_file_constraints(): void {
		this._registry.register(new TypeScriptFilePrivateMemberRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
		]);
		this._registry.register(new TypeScriptFileJestRules(), [ts.SyntaxKind.SourceFile]);
		this._registry.register(new TypeScriptLiteralConstantRules(), [ts.SyntaxKind.SourceFile]);
	}

	/** Responsibilities: _project registration destination_. **/
	public constructor(registry: ASTVerifierRegistrationContract) {
		this._registry = registry;
	}

	/** Responsibilities: _file rule registration_. **/
	public register_file_rules(): void {
		this.register_scope_rules();
		this.register_source_rules();
		this.register_file_constraints();
	}

	/** Responsibilities: _module rule registration_. **/
	public register_module_rules(): void {
		const { _registry: registry } = this;
		const source_file = [ts.SyntaxKind.SourceFile];
		registry.register(new TypeScriptModulePlacementRule(), source_file);
		registry.register(new TypeScriptProductionTestImportRule(), source_file);
	}

	/** Responsibilities: _project rule registration_. **/
	public register_project_rules(): void {
		const { _registry: registry } = this;
		const source_file = [ts.SyntaxKind.SourceFile];
		registry.register(new TypeScriptProjectClassFieldRules(), source_file);
		registry.register(new TypeScriptProjectUnusedSymbols(), source_file);
		registry.register(new TypeScriptProjectCompositionRules(), source_file);
		registry.register(new TypeScriptProjectCallableUsageRules(), source_file);
		registry.register(new TypeScriptProjectSharedParameterRules(), source_file);
	}

	/** Responsibilities: _project AST registration sequence_. **/
	public register_all(): void {
		this.register_file_rules();
		this.register_module_rules();
		this.register_project_rules();
	}
}
