import { TypeScriptBareAlias } from "src/bridge/ts/parser/typescript-bare-alias";
import { TypeScriptNodeRules } from "src/bridge/ts/parser-internals/typescript-node-rules";
import ts from "typescript";

import { RULES_BY_ID } from "src/model/constants";
import type { LintStageTimerProtocol, Violation } from "src/protocols";
import { TypeScriptClassFieldRules } from "src/model/typescript-class-field-rules";
import { UnnecessaryUndefinedCheck } from "src/bridge/ts/rules/unnecessary-undefined-check";
import { TestPathSyntax } from "src/test-path-syntax";
import { DuplicateTypeShapes } from "src/duplicate-type-shapes";

import type { Rule } from "src/protocols";
import type { RuleAppender, RuleContextData } from "src/types";
import type { SourceFileResolver } from "src/protocols";

/** Responsibilities: _TypeScript rule state retention_, _AST nodes rules dispatch_. **/
export class TypeScriptRuleContext {
	private readonly violations: Violation[];
	private readonly test_path_syntax = new TestPathSyntax();
	public readonly file: string;
	public readonly source_file: ts.SourceFile;
	public readonly test_file: boolean;
	public readonly class_fields = new TypeScriptClassFieldRules();
	public readonly source_resolver: SourceFileResolver;
	private readonly script_bare_alias = new TypeScriptBareAlias();
	private readonly script_node_rules = new TypeScriptNodeRules();
	private readonly unnecessary_undefined_check: UnnecessaryUndefinedCheck;
	private readonly duplicate_type_shapes = new DuplicateTypeShapes();
	private readonly stage_timer: LintStageTimerProtocol;

	public readonly append_rule: RuleAppender;

	/** Responsibilities: _resolution aggregation known rule_. **/
	private append_known_rule(node: ts.Node, rule_id: string): void {
		const rule = RULES_BY_ID.get(rule_id);
		if (rule === undefined) {
			return;
		}
		const line = this.source_file.getLineAndCharacterOfPosition(node.getStart(this.source_file)).line + 1;
		this.violations.push(rule.violation(this.file, line, {}));
	}

	/** Responsibilities: _namespace declaration recursive collection_. **/
	private namespace_declarations(): ts.ModuleDeclaration[] {
		const declarations: ts.ModuleDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isModuleDeclaration(node)) {
				if (ts.isIdentifier(node.name)) {
					declarations.push(node);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(this.source_file);
		return declarations;
	}

	/** Responsibilities: _namespace file rule violation_. **/
	private append_ns_rule(rule: Rule): void {
		for (const statement of this.source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				continue;
			}
			if (ts.isImportEqualsDeclaration(statement)) {
				continue;
			}
			if (!ts.isModuleDeclaration(statement)) {
				const line = this.source_file.getLineAndCharacterOfPosition(statement.getStart(this.source_file)).line + 1;
				this.violations.push(rule.violation(this.file, line, {}));
				return;
			}
		}
	}

	/** Responsibilities: _namespace file rule violation_. **/
	private append_namespace_rule(): void {
		const namespaces = this.namespace_declarations();
		if (namespaces.length === 0) {
			return;
		}
		const rule = RULES_BY_ID.get("typescript-namespace-file");
		if (rule === undefined) {
			return;
		}
		if (namespaces.length > 1) {
			const line = this.source_file.getLineAndCharacterOfPosition(namespaces[1].getStart(this.source_file)).line + 1;
			this.violations.push(rule.violation(this.file, line, {}));
			return;
		}
		this.append_ns_rule(rule);
	}

	/** Responsibilities: _duplicate type shape violations_. **/
	private append_duplicates(): void {
		for (const duplicate of this.duplicate_type_shapes.typescript(this.source_file)) {
			const rule = RULES_BY_ID.get("duplicate-type-shape");
			if (rule === undefined) {
				continue;
			}
			this.violations.push(rule.violation(this.file, duplicate.line, { names: duplicate.names.join(", ") }));
		}
	}

	/** Responsibilities: _node rules application_, _source tree traversal_. **/
	private append_node_tree(node: ts.Node, inside_constructor = false): void {
		const context: RuleContextData = this;
		this.script_node_rules.append_node_rules(node, inside_constructor, context);
		this.unnecessary_undefined_check.append(node);
		this.append_children(node, inside_constructor);
	}

	/** Responsibilities: _rule state initialization_, _wire rule appenders_. **/
	constructor(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		stage_timer: LintStageTimerProtocol,
		source_resolver: SourceFileResolver,
	) {
		this.violations = violations;
		this.file = file;
		this.source_file = source_file;
		this.stage_timer = stage_timer;
		this.source_resolver = source_resolver;
		this.test_file = this.test_path_syntax.test_file(file);
		this.append_rule = (node, rule_id) => this.append_known_rule(node, rule_id);
		this.unnecessary_undefined_check = new UnnecessaryUndefinedCheck(source_file, this.append_rule);
	}

	/** Responsibilities: _child nodes traversal_, _constructor context propagation_. **/
	public append_children(node: ts.Node, inside_constructor = false): void {
		let child_inside_constructor = inside_constructor;
		if (ts.isConstructorDeclaration(node)) {
			child_inside_constructor = true;
		}
		ts.forEachChild(node, (child) => this.append_node_tree(child, child_inside_constructor));
	}

	/** Responsibilities: _node rules application_, _source tree traversal_. **/
	public append(node: ts.Node, inside_constructor = false): void {
		if (node !== this.source_file) {
			this.append_node_tree(node, inside_constructor);
			return;
		}
		this.stage_timer.measure("file-analysis.typescript.coding-rules.root-rules", () => {
			this.append_namespace_rule();
			this.script_bare_alias.append_bare_aliases(this.violations, this.file, this.source_file);
		});
		this.stage_timer.measure("file-analysis.typescript.coding-rules.duplicate-type-shape", () =>
			this.append_duplicates(),
		);
		this.stage_timer.measure("file-analysis.typescript.coding-rules.node-rules", () =>
			this.append_node_tree(node, inside_constructor),
		);
	}
}
