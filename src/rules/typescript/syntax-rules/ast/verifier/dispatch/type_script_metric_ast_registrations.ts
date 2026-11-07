import type { ASTVerifierRegistrationContract } from "src/ast_verifier_protocols";
import { TypeScriptAttributeDepthRules } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_attribute_depth_rules";
import { TypeScriptCallableBranchRules } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_callable_branch_rules";
import { TypeScriptCallableRules } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_callable_rules";
import { TypeScriptFunctionMetricRules } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_function_metric_rules";
import { TypeScriptSharedParameterRules } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_shared_parameter_rules";
import { TypeScriptClassMetrics } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_metrics";
import { TypeScriptConstructorDependencyRule } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_constructor_dependency_rule";
import { TypeScriptDeclarationRules } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_declaration_rules";
import { ObjectLiteralReturnRules } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_literal_return_rules";
import { TypeScriptProjectBoundaryRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_rules";
import { TypeScriptTemporalCouplingRules } from "src/rules/typescript/syntax-rules/ast/verifier/temporal-analysis/type_script_temporal_coupling_rules";
import ts from "typescript";

/** Responsibilities: _metric rule registration_, _project boundary registration_. **/
export class TypeScriptMetricAstRegistrations {
	private readonly _registry: ASTVerifierRegistrationContract;

	/** Responsibilities: _class state metric registration_. **/
	private register_class_state(): void {
		this._registry.register(new TypeScriptClassMetrics(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
		]);
		this._registry.register(new TypeScriptConstructorDependencyRule(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
		]);
		this._registry.register(new TypeScriptSharedParameterRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
		]);
	}

	/** Responsibilities: _callable declaration metric registration_. **/
	private register_callable_declarations(): void {
		this._registry.register(new TypeScriptFunctionMetricRules(), [
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.VariableDeclaration,
		]);
		this._registry.register(new TypeScriptCallableRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
		]);
	}

	/** Responsibilities: _callable flow metric registration_. **/
	private register_callable_flow(): void {
		this._registry.register(new TypeScriptCallableBranchRules(), [
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
		]);
		this._registry.register(new TypeScriptAttributeDepthRules(), [ts.SyntaxKind.PropertyAccessExpression]);
		this._registry.register(new TypeScriptTemporalCouplingRules(), [ts.SyntaxKind.ClassDeclaration]);
	}

	/** Responsibilities: _metric registration destination_. **/
	public constructor(registry: ASTVerifierRegistrationContract) {
		this._registry = registry;
	}

	/** Responsibilities: _class metric registration_. **/
	public register_class_metrics(): void {
		this._registry.register(new ObjectLiteralReturnRules(), [
			ts.SyntaxKind.ReturnStatement,
			ts.SyntaxKind.TypeAliasDeclaration,
		]);
		this.register_class_state();
		this._registry.register(new TypeScriptDeclarationRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
		]);
	}

	/** Responsibilities: _callable metric registration_. **/
	public register_callable_metrics(): void {
		this.register_callable_declarations();
		this.register_callable_flow();
	}

	/** Responsibilities: _project boundary registration_. **/
	public register_project_boundaries(): void {
		const { _registry: registry } = this;
		registry.register(new TypeScriptProjectBoundaryRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
		]);
	}

	/** Responsibilities: _metric AST registration sequence_. **/
	public register_all(): void {
		this.register_class_metrics();
		this.register_callable_metrics();
		this.register_project_boundaries();
	}
}
