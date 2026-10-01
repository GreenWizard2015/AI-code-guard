import { TypeScriptStructuralRules } from "src/bridge/ts/parser-internals/typescript-structural-rules";
import { TypeScriptBoundaryRuleAppender } from "src/bridge/ts/parser-internals/type-union-rules/boundary-rule-appender";
import { TypeScriptConditionalRules } from "src/bridge/ts/parser-internals/typescript-conditional-rules";
import { TypeScriptTerminalBranches } from "src/bridge/ts/parser-internals/typescript-terminal-rules";
import ts from "typescript";
import { EARLY_RETURN } from "src/bridge/ts/parser-internals/constants";
import type { RuleContextData } from "src/types";

/** Responsibilities: _aggregation TypeScript conditional structural_. **/
export class TypeScriptTypeRules {
	private readonly structural_rules = new TypeScriptStructuralRules();
	private readonly boundary_rules = new TypeScriptBoundaryRuleAppender();
	private readonly conditional_rules = new TypeScriptConditionalRules();
	private readonly terminal_branches = new TypeScriptTerminalBranches();

	/** Responsibilities: _aggregation structural type rules_. **/
	public append_structure_rules(node: ts.Node, context: RuleContextData): void {
		this.structural_rules.append(node, context);
		this.conditional_rules.append(node, context.source_file, context.append_rule);
		if (ts.isIfStatement(node)) {
			this.conditional_rules.append_if_block(node, context.append_rule);
			if (this.terminal_branches.early_exit(node)) {
				context.append_rule(node, EARLY_RETURN);
			}
		}
	}

	/** Responsibilities: _aggregation type conditional rules_. **/
	public append_type_rules(node: ts.Node, context: RuleContextData): void {
		this.boundary_rules.append(node, context);
		this.append_structure_rules(node, context);
	}
}
