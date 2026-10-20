import { TypeScriptStructuralRules } from "src/rules/typescript/syntax-rules/types/type_script_structural_rules";
import { TypeScriptBoundaryRuleAppender } from "src/rules/typescript/syntax-rules/types/type_script_boundary_rule_appender";
import { TypeScriptConditionalRules } from "src/rules/typescript/syntax-rules/expressions/type_script_conditional_rules";
import { TypeScriptTerminalBranches } from "src/rules/typescript/syntax-rules/expressions/type_script_terminal_branches";
import { NullableTypeRules } from "src/rules/typescript/syntax-rules/types/nullable_type_rules";
import { CompositeStateTypeRules } from "src/rules/typescript/syntax-rules/types/composite_state_type_rules";
import { TypeScriptAssignmentPredicates } from "src/parser/internals/type_script_assignment_predicates";
import { TypeScriptOperatorPrecedence } from "src/rules/typescript/syntax-rules/expressions/type_script_operator_precedence";
import ts from "typescript";
import { EARLY_RETURN } from "src/parser/internals/constants";
import type { RuleContextData } from "src/types";
import type { TypeScriptAssignmentPredicatesContract, TypeScriptNodeTypeRulesContract, TypeScriptConditionalRulesContract, TypeScriptTerminalBranchesContract, TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { NullableTypeRulesContract, CompositeStateTypeRulesContract } from "src/runtime_protocols";

/** Responsibilities: _type diagnostics_, _conditional types_. **/
export class TypeScriptTypeRules implements TypeScriptNodeTypeRulesContract {
	private readonly terminal_branches: TypeScriptTerminalBranchesContract;
	private readonly operator_precedence: TypeScriptOperatorPrecedence;
	private readonly structural_rules: TypeScriptStructuralRules;
	private readonly assignment_predicates: TypeScriptAssignmentPredicatesContract;
	private readonly conditional_rules: TypeScriptConditionalRulesContract;
	private readonly nullable_type_rules: NullableTypeRulesContract;
	private readonly composite_state_type: CompositeStateTypeRulesContract;
	private readonly boundary_rules: TypeScriptBoundaryRuleAppender;
	private readonly applicable_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _TypeScript type rules initialization_. **/
	public constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this.terminal_branches = new TypeScriptTerminalBranches();
		this.operator_precedence = new TypeScriptOperatorPrecedence();
		this.structural_rules = new TypeScriptStructuralRules(this.operator_precedence);
		this.assignment_predicates = new TypeScriptAssignmentPredicates();
		this.nullable_type_rules = new NullableTypeRules();
		this.composite_state_type = new CompositeStateTypeRules(this.nullable_type_rules);
		this.boundary_rules = new TypeScriptBoundaryRuleAppender(
			this.nullable_type_rules,
			this.composite_state_type,
			variable_declaration_index,
		);
		this.conditional_rules = new TypeScriptConditionalRules(this.assignment_predicates, variable_declaration_index);
		this.applicable_kinds = new Set([
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.PropertySignature,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.UnionType,
			ts.SyntaxKind.IntersectionType,
			ts.SyntaxKind.ThrowStatement,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.CatchClause,
			ts.SyntaxKind.TypeOfExpression,
			ts.SyntaxKind.TypeAssertionExpression,
			ts.SyntaxKind.AsExpression,
			ts.SyntaxKind.AnyKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.ObjectKeyword,
			ts.SyntaxKind.TypeReference,
			ts.SyntaxKind.IndexSignature,
			ts.SyntaxKind.TypeAliasDeclaration,
		]);
	}

	/** Responsibilities: _aggregation structural type rules_. **/
	public append_structure_rules(node: ts.Node, context: RuleContextData): void {
		this.structural_rules.append(node, context);
		switch (node.kind) {
			case ts.SyntaxKind.BinaryExpression:
			case ts.SyntaxKind.ConditionalExpression:
				this.conditional_rules.append(node, context.source_file, context.append_rule);
				break;
			default:
				break;
		}
		if (ts.isIfStatement(node)) {
			this.conditional_rules.append_if_block(node, context.append_rule);
			if (this.terminal_branches.early_exit(node)) {
				context.append_rule(node, EARLY_RETURN);
			}
		}
	}

	/** Responsibilities: _aggregation typed node rules_. **/
	public append_type_rules(node: ts.Node, context: RuleContextData): void {
		if (!this.applicable_kinds.has(node.kind)) {
			return;
		}
		this.boundary_rules.append(node, context);
		this.append_structure_rules(node, context);
	}
}
