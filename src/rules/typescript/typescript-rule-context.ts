import { TypeScriptBareAlias } from 'src/bridge/ts/parser/typescript-bare-alias';
import { TypeScriptNodeRules } from 'src/bridge/ts/parser-internals/typescript-node-rules';
import ts from 'typescript';

import { RULES_BY_ID } from 'src/model/constants';
import type { Violation } from 'src/protocols';
import { TypeScriptClassFieldRules } from 'src/model/typescript-class-field-rules';
import { UnnecessaryUndefinedCheck } from 'src/bridge/ts/rules/unnecessary-undefined-check';
import { TestPathSyntax } from 'src/test-path-syntax';
import { DuplicateTypeShapes } from 'src/duplicate-type-shapes';

import type { Rule } from 'src/protocols';
import type { RuleAppender, RuleContextData } from 'src/types';

/** Responsibilities: _TypeScript rule state retention_, _AST nodes rules dispatch_. **/
export class TypeScriptRuleContext {
	private readonly violations: Violation[];
	private readonly test_path_syntax = new TestPathSyntax();
	public readonly file: string;
	public readonly source_file: ts.SourceFile;
	public readonly test_file: boolean;
	public readonly class_fields = new TypeScriptClassFieldRules();
	private readonly script_bare_alias = new TypeScriptBareAlias();
	private readonly script_node_rules = new TypeScriptNodeRules();
	private readonly unnecessary_undefined_check: UnnecessaryUndefinedCheck;
	private readonly duplicate_type_shapes = new DuplicateTypeShapes();

	public readonly append_rule: RuleAppender;

	/** Responsibilities: _aggregation rule violation AST_. **/
	private append_rule_violation(rule: Rule, node: ts.Node): void {
		const line =
			this.source_file.getLineAndCharacterOfPosition(node.getStart(this.source_file)).line + 1;
		this.violations.push(rule.violation(this.file, line, {}));
	}

	/** Responsibilities: _resolution aggregation known rule_. **/
	private append_known_rule(node: ts.Node, rule_id: string): void {
		const rule = RULES_BY_ID.get(rule_id);
		if (rule === undefined) {
			return;
		}
		this.append_rule_violation(rule, node);
	}

	/** Responsibilities: _rule state initialization_, _wire rule appenders_. **/
	constructor(violations: Violation[], file: string, source_file: ts.SourceFile) {
		this.violations = violations;
		this.file = file;
		this.source_file = source_file;
		this.test_file = this.test_path_syntax.test_file(file);
		this.append_rule = (node, rule_id) => this.append_known_rule(node, rule_id);
		this.unnecessary_undefined_check = new UnnecessaryUndefinedCheck(source_file, this.append_rule);
	}

	/** Responsibilities: _child nodes traversal_, _context propagation _. **/
	public append_children(node: ts.Node, inside_constructor = false): void {
		let child_inside_constructor = inside_constructor;
		if (ts.isConstructorDeclaration(node)) {
			child_inside_constructor = true;
		}
		ts.forEachChild(node, child => this.append(child, child_inside_constructor));
	}

	/** Responsibilities: _node rules application_, _source tree traversal_. **/
	public append(node: ts.Node, inside_constructor = false): void {
		if (node === this.source_file) {
			this.script_bare_alias.append_bare_aliases(this.violations, this.file, this.source_file);
			for (const duplicate of this.duplicate_type_shapes.typescript(this.source_file)) {
				const rule = RULES_BY_ID.get('duplicate-type-shape');
				if (rule !== undefined) {
					this.violations.push(rule.violation(this.file, duplicate.line, { names: duplicate.names.join(', ') }));
				}
			}
		}
		const context: RuleContextData = this;
		this.script_node_rules.append_node_rules(node, inside_constructor, context);
		this.unnecessary_undefined_check.append(node);
		this.append_children(node, inside_constructor);
	}
}
