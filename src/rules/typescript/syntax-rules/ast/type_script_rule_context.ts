import { TypeScriptBareAlias } from "src/rules/typescript/syntax-rules/callables/type_script_bare_alias";
import ts from "typescript";

import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DuplicateTypeShapesContract } from "src/analysis_protocols";
import type { TypeScriptNodeRulesContract } from "src/typescript_analysis_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptClassFieldRules } from "src/model/type_script_class_field_rules";
import { TestPathSyntax } from "src/test_path_syntax";
import { DuplicateTypeShapes } from "src/duplicate_type_shapes";
import { UndefinedCheckRules } from "src/rules/typescript/syntax-rules/runtime/undefined_check_rules";
import { RULE_IDS } from "src/constants";

import type { RuleContract } from "src/reporting_protocols";
import type { TypeScriptAstTraversalContract, TypeScriptRuleTreeTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptClassFieldRulesContract } from "src/typescript_analysis_protocols";
import type { RuleAppender, RuleContextData } from "src/types";
import type { TypeScriptRuleContextOptions } from "src/types";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import { TypeScriptRuleTreeTraversal } from "src/rules/typescript/syntax-rules/ast/type_script_rule_tree_traversal";

/** Responsibilities: _TypeScript rule state retention_, _AST nodes rules dispatch_. **/
export class TypeScriptRuleContext {
	private readonly violations: ViolationContract[];
	private readonly test_path_syntax: TestPathSyntax;
	public readonly file: string;
	public readonly source_file: ts.SourceFile;
	public readonly test_file: boolean;
	public readonly class_fields: TypeScriptClassFieldRulesContract;
	public readonly source_resolver: ReadonlyMap<string, ts.SourceFile>;
	public readonly module_resolver: TypeScriptPropertyModuleResolverContract;
	private readonly script_bare_alias: TypeScriptBareAlias;
	private readonly script_node_rules: TypeScriptNodeRulesContract;
	private readonly undefined_check_rules: UndefinedCheckRules;
	private readonly tree_traversal: TypeScriptRuleTreeTraversalContract;
	private readonly duplicate_type_shapes: DuplicateTypeShapesContract;
	private readonly stage_timer: LintStageTimerContract;
	private readonly traversal: TypeScriptAstTraversalContract;
	public readonly append_rule: RuleAppender;

	/** Responsibilities: _resolution aggregation known rule_. **/
	private append_known_rule(node: ts.Node, rule_id: string): void {
		const rule = new DiagnosticRule(rule_id);
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
	private append_ns_rule(rule: RuleContract): void {
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
		const rule = new DiagnosticRule(RULE_IDS.typescript_namespace_file);
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
			const rule = new DiagnosticRule(RULE_IDS.duplicate_type_shape);
			this.violations.push(rule.violation(this.file, duplicate.line, { names: duplicate.names.join(", ") }));
		}
	}

	/** Responsibilities: _node tree rules_. **/
	private append_node_tree(node: ts.Node, inside_constructor = false): void {
		const context: RuleContextData = this;
		this.script_node_rules.append_node_rules(node, inside_constructor, context);
		this.undefined_check_rules.append(node);
	}

	/** Responsibilities: _rule state initialization_, _wire rule appenders_. **/
	constructor(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		options: TypeScriptRuleContextOptions,
	) {
		this.test_path_syntax = new TestPathSyntax();
		this.class_fields = new TypeScriptClassFieldRules();
		this.script_bare_alias = new TypeScriptBareAlias();
		this.duplicate_type_shapes = new DuplicateTypeShapes();
		this.script_node_rules = options.node_rules;
		this.violations = violations;
		this.file = file;
		this.source_file = source_file;
		this.stage_timer = options.stage_timer;
		this.source_resolver = options.source_resolver;
		this.module_resolver = options.module_exports;
		this.traversal = options.traversal;
		this.test_file = this.test_path_syntax.test_file(file);
		this.append_rule = (node, rule_id) => this.append_known_rule(node, rule_id);
		this.undefined_check_rules = new UndefinedCheckRules(source_file, this.append_rule, options);
		this.tree_traversal = new TypeScriptRuleTreeTraversal(
			this.traversal,
			this.script_node_rules,
			this.undefined_check_rules,
		);
	}

	/** Responsibilities: _source-file root rule application_, _source tree traversal_. **/
	public append_source_file(node: ts.Node, inside_constructor: boolean): void {
		this.stage_timer.measure("file-analysis.typescript.coding-rules.root-rules", () => {
			this.append_namespace_rule();
			this.script_bare_alias.append_bare_aliases(this.violations, this.file, this.source_file);
		});
		this.stage_timer.measure("file-analysis.typescript.coding-rules.duplicate-type-shape", () =>
			this.append_duplicates(),
		);
		this.stage_timer.measure("file-analysis.typescript.coding-rules.node-rules", () => {
			this.stage_timer.measure("file-analysis.typescript.coding-rules.node-rules.root", () =>
				this.script_node_rules.append_node_rules(node, inside_constructor, this),
			);
			this.undefined_check_rules.append(node);
			this.stage_timer.measure("file-analysis.typescript.coding-rules.node-rules.children", () =>
				this.tree_traversal.append_root_children(this),
			);
		});
	}

	/** Responsibilities: _node rules application_, _source tree traversal_. **/
	public append(node: ts.Node, inside_constructor = false): void {
		if (node !== this.source_file) {
			this.append_node_tree(node, inside_constructor);
			this.tree_traversal.append_nested_children(node, inside_constructor, this);
			return;
		}
		this.append_source_file(node, inside_constructor);
	}
}
