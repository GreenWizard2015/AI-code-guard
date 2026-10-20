import { PythonCodingRuleCollector } from "src/linting/orchestration/runtime/python/python_coding_rule_collector";
import { TypeScriptCodingRules } from "src/linting/orchestration/runtime/type_script_coding_rules";
import { Syntax } from "src/parser/analysis/syntax";

import {
	RESPONSIBILITY_ACTION_EXTENSIONS,
	RESPONSIBILITY_ACTION_WORDS,
	RESPONSIBILITY_CONDITION_WORDS,
	RESPONSIBILITY_NOUN_WORDS,
} from "src/linting/orchestration/runtime/constants";
import { ResponsibilityRules } from "src/linting/orchestration/runtime/responsibility-wording/responsibility_rules";
import { ResponsibilityWording } from "src/linting/orchestration/runtime/responsibility-wording/responsibility_wording";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { PythonCodingRuleCollectorContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptNodeRules } from "src/rules/typescript/syntax-rules/ast/type_script_node_rules";
import { TypeScriptRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_rule_context";
import type { SyntaxContract } from "src/shared_services_protocols";
import type { SourceFileAstContract } from "src/source_protocols";
import type { CodingRuleSourceData } from "src/source_types";
import type ts from "typescript";

import { AstPropertySourceIndexCache } from "src/ast_property_source_index_cache";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import type { CodingRuleLinterContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptNodeRulesContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _collection TypeScript Python coding_, _responsibility violations collection_. **/
export class CodingRuleLinter implements CodingRuleLinterContract {
	private readonly python_rule_collector: PythonCodingRuleCollectorContract;
	private readonly syntax: SyntaxContract;
	private readonly responsibility_rules: ResponsibilityRules;
	private readonly typescript_coding_rules: TypeScriptCodingRules;
	private readonly project_root: string;
	private readonly filesystem_fallback: boolean;
	private readonly source_io: ProjectSourceIOContract;
	private readonly module_resolvers: WeakMap<SourceFileResolver, TypeScriptPropertyModuleResolverContract>;
	private readonly source_indexes: WeakMap<SourceFileResolver, AstPropertySourceIndexContract>;
	private readonly resolver_node_rules: WeakMap<SourceFileResolver, TypeScriptNodeRulesContract>;

	/** Responsibilities: _run-local module resolver reuse_. **/
	private module_exports(source: CodingRuleSourceData): TypeScriptPropertyModuleResolverContract {
		const cached = this.module_resolvers.get(source.source_resolver);
		if (cached !== undefined) {
			return cached;
		}
		const created = new TypeScriptModuleExports(
			this.project_root,
			source.source_resolver,
			this.filesystem_fallback,
			this.source_io,
		);
		this.module_resolvers.set(source.source_resolver, created);
		return created;
	}

	/** Responsibilities: _shared property index_. **/
	private source_index(source: CodingRuleSourceData): AstPropertySourceIndexContract {
		const cached = this.source_indexes.get(source.source_resolver);
		if (cached !== undefined) {
			return cached;
		}
		const created = new AstPropertySourceIndexCache();
		this.source_indexes.set(source.source_resolver, created);
		return created;
	}

	/** Responsibilities: _run-local node rule reuse_. **/
	private node_rules(source: CodingRuleSourceData): TypeScriptNodeRulesContract {
		const cached = this.resolver_node_rules.get(source.source_resolver);
		if (cached !== undefined) {
			return cached;
		}
		const created = new TypeScriptNodeRules();
		this.resolver_node_rules.set(source.source_resolver, created);
		return created;
	}

	/** Responsibilities: _TypeScript rules_. **/
	private append_typescript_rules(
		violations: ViolationContract[],
		source: CodingRuleSourceData,
		source_file: ts.SourceFile,
		stage_timer: LintStageTimerContract,
	): void {
		const context = new TypeScriptRuleContext(violations, source.file, source_file, {
			stage_timer,
			source_resolver: source.source_resolver,
			node_rules: this.node_rules(source),
			module_exports: this.module_exports(source),
			source_index: this.source_index(source),
			traversal: source.traversal,
		});
		stage_timer.measure("file-analysis.typescript.post-remaining.coding-rules.ast-rules", () =>
			context.append(source_file),
		);
		if (this.syntax.syntax_issues(source_file).length > 0) {
			this.typescript_coding_rules.append_recovered_rules(violations, source.file, source.text);
		}
	}

	/** Responsibilities: _TypeScript syntax rules_. **/
	private collect_typescript_rules(
		source: CodingRuleSourceData,
		stage_timer: LintStageTimerContract,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		if (source.file.endsWith(".py")) {
			return violations;
		}
		this.append_typescript_rules(violations, source, source.source_file, stage_timer);
		return violations;
	}

	/** Responsibilities: _Python rule collector initialization_. **/
	public constructor(project_root: string, source_io: ProjectSourceIOContract, filesystem_fallback = true) {
		this.project_root = project_root;
		this.filesystem_fallback = filesystem_fallback;
		this.source_io = source_io;
		this.syntax = new Syntax();
		this.responsibility_rules = new ResponsibilityRules(
			new ResponsibilityWording(
				new Set([...RESPONSIBILITY_ACTION_WORDS, ...RESPONSIBILITY_ACTION_EXTENSIONS]),
				RESPONSIBILITY_CONDITION_WORDS,
				RESPONSIBILITY_NOUN_WORDS,
			),
		);
		this.typescript_coding_rules = new TypeScriptCodingRules();
		this.python_rule_collector = new PythonCodingRuleCollector();
		this.module_resolvers = new WeakMap<SourceFileResolver, TypeScriptPropertyModuleResolverContract>();
		this.source_indexes = new WeakMap<SourceFileResolver, AstPropertySourceIndexContract>();
		this.resolver_node_rules = new WeakMap<SourceFileResolver, TypeScriptNodeRulesContract>();
	}

	/** Responsibilities: _Python source rule violations_. **/
	public lint_python(source_ast: SourceFileAstContract): ViolationContract[] {
		const prepared_source = source_ast.snapshot();
		const responsibilities = this.responsibility_rules.collect(
			prepared_source.file,
			prepared_source.normalized_ast.responsibility_targets,
		);
		return [...responsibilities, ...this.python_rule_collector.collect_python_rules(prepared_source)];
	}

	/** Responsibilities: _TypeScript source rule violations_. **/
	public lint_typescript(source_ast: SourceFileAstContract, stage_timer: LintStageTimerContract): ViolationContract[] {
		const prepared_source = source_ast.snapshot();
		const responsibilities = this.responsibility_rules.collect(
			prepared_source.file,
			prepared_source.normalized_ast.responsibility_targets,
		);
		return [...responsibilities, ...this.collect_typescript_rules(prepared_source, stage_timer)];
	}
}
