import type { ASTSourceRuleContract, ASTVerifierRegistrationContract } from "src/ast_verifier_protocols";
import { RULE_IDS as LINT_RULE_IDS } from "src/linting/constants";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";
import { ValueRules } from "src/linting/value_rules";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { TypeScriptClassNodeRules } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_node_rules";
import { TypeScriptValueNodeVerifier } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/type_script_value_node_verifier";
import { TypeScriptNodeRuntimeRuleSet } from "src/rules/typescript/syntax-rules/runtime/type_script_node_runtime_rule_set";
import { ASTTypeRules } from "src/rules/typescript/syntax-rules/types/ast_type_rules";
import { DictionaryReturns } from "src/rules/typescript/syntax-rules/types/dictionary_returns";
import { InlineTypes } from "src/rules/typescript/syntax-rules/types/inline_types";
import { TypeOperations } from "src/rules/typescript/syntax-rules/types/type_operations";
import { TypeScriptTypeRules } from "src/rules/typescript/syntax-rules/types/type_script_type_rules";
import { TypeScriptMixedModuleRule } from "src/type_script_mixed_module_rule";
import ts from "typescript";

/** Responsibilities: _core verifier setup_, _AST node registration_. **/
export class TypeScriptCoreAstRegistrations {
	private readonly _declarations: TypeScriptVariableDeclarationIndex;
	private readonly _aliases: TypeScriptObjectAliasDeclarationIndex;
	private readonly _runtime_rules: TypeScriptNodeRuntimeRuleSet;
	private readonly _registry: ASTVerifierRegistrationContract;

	/** Responsibilities: _syntax declaration registration_. **/
	private register_syntax_declarations(syntax_rules: ASTSourceRuleContract): void {
		this._registry.register(syntax_rules, [
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.CallSignature,
			ts.SyntaxKind.JSDocSignature,
			ts.SyntaxKind.ConstructSignature,
			ts.SyntaxKind.JSDocFunctionType,
			ts.SyntaxKind.ConstructorType,
			ts.SyntaxKind.SourceFile,
		]);
	}

	/** Responsibilities: _syntax expression node registration_. **/
	private register_syntax_expressions(syntax_rules: ASTSourceRuleContract): void {
		this._registry.register(syntax_rules, [
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.NewExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
		]);
	}

	/** Responsibilities: _class member rule registration_. **/
	private register_class_members(): void {
		const value_rules = new ValueRules(this._declarations, this._aliases);
		const class_rules = new TypeScriptClassNodeRules(value_rules, this._aliases);
		this._registry.register(class_rules, [
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.PrefixUnaryExpression,
			ts.SyntaxKind.PostfixUnaryExpression,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
			ts.SyntaxKind.ForInStatement,
			ts.SyntaxKind.ForOfStatement,
		]);
	}

	/** Responsibilities: _type declaration analysis registration_. **/
	private register_type_declarations(type_rules: ASTSourceRuleContract): void {
		this._registry.register(type_rules, [
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.PropertySignature,
			ts.SyntaxKind.UnionType,
			ts.SyntaxKind.IntersectionType,
			ts.SyntaxKind.AnyKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.ObjectKeyword,
			ts.SyntaxKind.TypeReference,
			ts.SyntaxKind.IndexSignature,
			ts.SyntaxKind.TypeAliasDeclaration,
		]);
	}

	/** Responsibilities: _type expression registration_. **/
	private register_type_expressions(type_rules: ASTSourceRuleContract): void {
		this._registry.register(type_rules, [
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.ConstructorType,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
			ts.SyntaxKind.TupleType,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.ThrowStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.CatchClause,
			ts.SyntaxKind.TypeOfExpression,
			ts.SyntaxKind.TypeAssertionExpression,
			ts.SyntaxKind.AsExpression,
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.IfStatement,
		]);
	}

	/** Responsibilities: _inline type registration_. **/
	private register_inline_types(): void {
		this._registry.register(new InlineTypes(), [
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.TypeLiteral,
			ts.SyntaxKind.FunctionType,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.UnionType,
		]);
	}

	/** Responsibilities: _type operation analysis registration_. **/
	private register_type_operations(): void {
		this._registry.register(new TypeOperations(), [
			ts.SyntaxKind.TypeReference,
			ts.SyntaxKind.TypeOperator,
			ts.SyntaxKind.IndexedAccessType,
			ts.SyntaxKind.IntersectionType,
			ts.SyntaxKind.ConditionalType,
			ts.SyntaxKind.MappedType,
		]);
		this._registry.register(new ASTTypeRules(), [ts.SyntaxKind.FunctionType, ts.SyntaxKind.TypeReference]);
	}

	/** Responsibilities: _dictionary return analysis registration_. **/
	private register_dictionary_returns(): void {
		this._registry.register(new DictionaryReturns(), [
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.CallSignature,
			ts.SyntaxKind.ConstructSignature,
			ts.SyntaxKind.FunctionType,
			ts.SyntaxKind.ConstructorType,
		]);
	}

	/** Responsibilities: _core verifier setup_. **/
	public constructor(registry: ASTVerifierRegistrationContract) {
		this._registry = registry;
		this._declarations = new TypeScriptVariableDeclarationIndex();
		this._aliases = new TypeScriptObjectAliasDeclarationIndex();
		this._runtime_rules = new TypeScriptNodeRuntimeRuleSet(this._aliases);
	}

	/** Responsibilities: _syntax node registrations_. **/
	public register_syntax(): void {
		const syntax_rules = this._runtime_rules.syntax_verifier(
			new DiagnosticRule(LINT_RULE_IDS.typescript_type_guard),
			new DiagnosticRule(LINT_RULE_IDS.typescript_bind),
		);
		this.register_syntax_declarations(syntax_rules);
		this._registry.register(new TypeScriptMixedModuleRule(new DiagnosticRule(LINT_RULE_IDS.mixed_module)), [
			ts.SyntaxKind.SourceFile,
		]);
		this.register_syntax_expressions(syntax_rules);
		this.register_class_members();
		this._runtime_rules.register_context_rules(this._registry);
	}

	/** Responsibilities: _type node registrations_. **/
	public register_types(): void {
		const type_rules = new TypeScriptTypeRules(this._declarations, this._aliases);
		this.register_type_declarations(type_rules);
		this.register_type_expressions(type_rules);
		this.register_inline_types();
		this.register_type_operations();
		this.register_dictionary_returns();
	}

	/** Responsibilities: _runtime node registrations_. **/
	public register_runtime(): void {
		this._runtime_rules.register_runtime_rules(this._registry);
		this._registry.register(new TypeScriptValueNodeVerifier(this._aliases), [
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.ElementAccessExpression,
			ts.SyntaxKind.Identifier,
			ts.SyntaxKind.ObjectLiteralExpression,
		]);
	}

	/** Responsibilities: _core AST registration sequence_. **/
	public register_all(): void {
		this.register_syntax();
		this.register_types();
		this.register_runtime();
	}
}
