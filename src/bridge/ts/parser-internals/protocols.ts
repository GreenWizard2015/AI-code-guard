import type ts from 'typescript';
import type { RuleContextData } from 'src/types';

/** Responsibilities: _define TypeScript node type-rule_. **/
export interface TypeScriptNodeTypeRules {
	append_type_rules(node: ts.Node, context: RuleContextData): void;
}
