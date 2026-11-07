import type { ASTVerifierRegistrationContract } from "src/ast_verifier_protocols";
import { TYPE_SCRIPT_CALLABLE_BODY_KINDS } from "src/constants";
import { PointlessAssignments } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/pointless_assignments";
import { TypeScriptAssignmentAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_assignment_analysis";
import { TypeScriptStateRules } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_state_rules";
import { TypeScriptImportRules } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_import_rules";
import { TypeScriptModuleDeclarationNaming } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_module_declaration_naming";
import { TypeScriptNamingRules } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_naming_rules";
import { TypeScriptErrorRules } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_error_rules";
import { UnboundedRetryLoop } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/unbounded_retry_loop";
import { ConcreteCollaboratorCreation } from "src/rules/typescript/syntax-rules/types/concrete_collaborator_creation";
import { FiniteVariantMapping } from "src/rules/typescript/syntax-rules/types/finite_variants/finite_variant_mapping";
import ts from "typescript";

/** Responsibilities: _behavior rule registration_, _declaration rule registration_. **/
export class TypeScriptBehaviorAstRegistrations {
	private readonly _registry: ASTVerifierRegistrationContract;

	/** Responsibilities: _behavior registration destination_. **/
	public constructor(registry: ASTVerifierRegistrationContract) {
		this._registry = registry;
	}

	/** Responsibilities: _control rule registration_. **/
	public register_control_rules(): void {
		const { _registry: registry } = this;
		const assignment_analysis = new TypeScriptAssignmentAnalysis(
			new Set([ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.FunctionExpression]),
		);
		registry.register(new PointlessAssignments(assignment_analysis), TYPE_SCRIPT_CALLABLE_BODY_KINDS);
		registry.register(new FiniteVariantMapping(), [
			ts.SyntaxKind.SwitchStatement,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.EnumDeclaration,
			ts.SyntaxKind.InterfaceDeclaration,
		]);
		registry.register(new ConcreteCollaboratorCreation(), [ts.SyntaxKind.NewExpression]);
		registry.register(new TypeScriptStateRules(), [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.PropertyDeclaration,
		]);
		registry.register(new TypeScriptErrorRules(), [ts.SyntaxKind.CatchClause]);
		registry.register(new UnboundedRetryLoop(), [ts.SyntaxKind.WhileStatement]);
	}

	/** Responsibilities: _declaration name registration_. **/
	public register_name_rules(): void {
		const { _registry: registry } = this;
		registry.register(new TypeScriptModuleDeclarationNaming(), [ts.SyntaxKind.VariableDeclaration]);
		registry.register(new TypeScriptNamingRules(), [
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.PropertySignature,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.ImportClause,
			ts.SyntaxKind.ImportSpecifier,
			ts.SyntaxKind.NamespaceImport,
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.EnumDeclaration,
		]);
	}

	/** Responsibilities: _source import registration_. **/
	public register_import_rules(): void {
		const { _registry: registry } = this;
		registry.register(new TypeScriptImportRules(), [
			ts.SyntaxKind.ImportDeclaration,
			ts.SyntaxKind.ImportEqualsDeclaration,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.ImportType,
		]);
	}

	/** Responsibilities: _behavior AST registration sequence_. **/
	public register_all(): void {
		this.register_control_rules();
		this.register_name_rules();
		this.register_import_rules();
	}
}
