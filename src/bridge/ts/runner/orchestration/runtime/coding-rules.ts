import { PythonCodingRuleCollector } from 'src/bridge/ts/runner/orchestration/runtime/python/python-coding-rule-collector';
import { Syntax } from 'src/syntax';
import { TypeScriptCodingRules } from 'src/bridge/ts/runner/orchestration/runtime/typescript-coding-rules';

import type { Violation } from 'src/protocols';
import type { CodingRuleSource } from 'src/coding-rule-source';
import { TypeScriptRuleContext } from 'src/rules/typescript/typescript-rule-context';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { RESPONSIBILITY_ACTION_EXTENSIONS, RESPONSIBILITY_ACTION_WORDS, RESPONSIBILITY_CONDITION_WORDS, RESPONSIBILITY_NOUN_WORDS } from 'src/bridge/ts/runner/orchestration/runtime/constants';
import { ResponsibilityRules } from 'src/bridge/ts/runner/orchestration/runtime/responsibility-wording/responsibility-rules';
import { ResponsibilityWording } from 'src/bridge/ts/runner/orchestration/runtime/responsibility-wording/responsibility-wording';

import type { CodingRuleLinterContract } from 'src/bridge/ts/runner/orchestration/runtime/protocols';

/** Responsibilities: _collection TypeScript Python coding_, _responsibility violations collection_. **/
export class CodingRuleLinter implements CodingRuleLinterContract {
	private readonly source: CodingRuleSource;
	private readonly source_ast: SourceFileAst;
	private readonly python_rule_collector: PythonCodingRuleCollector;
	private readonly syntax = new Syntax();
	private readonly responsibility_rules = new ResponsibilityRules(
		new ResponsibilityWording(
			new Set([...RESPONSIBILITY_ACTION_WORDS, ...RESPONSIBILITY_ACTION_EXTENSIONS]),
			RESPONSIBILITY_CONDITION_WORDS,
			RESPONSIBILITY_NOUN_WORDS,
		),
	);

	/** Responsibilities: _collection TypeScript syntax coding-rule_. **/
	private collect_typescript_rules(source: CodingRuleSource): Violation[] {
		const script_coding_rules = new TypeScriptCodingRules();

		const violations: Violation[] = [];
		if (!this.source_ast.typescript()) {
			return violations;
		}
		const source_file = source.source_file;
		if (!source_file) {
			return violations;
		}
		const context = new TypeScriptRuleContext(violations, source.file, source_file);
		context.append(source_file);
		if (this.syntax.syntax_issues(source_file).length > 0) {
			script_coding_rules.append_recovered_rules(violations, source.file, source.text);
		}
		return violations;
	}

	/** Responsibilities: _initialization source language rule_, _source data storage_. **/
	public constructor(source_ast: SourceFileAst) {
		this.python_rule_collector = new PythonCodingRuleCollector();
		this.source_ast = source_ast;
		this.source = source_ast.source;
	}

	/** Responsibilities: _responsibility violations collection_, _language-specific violations collection_. **/
	public lint(): Violation[] {
		const prepared_source = this.source;
		const responsibilities = this.responsibility_rules.collect(
			prepared_source.file,
			prepared_source.normalized_ast.responsibility_targets,
		);
		if (this.source_ast.python()) {
			return [...responsibilities, ...this.python_rule_collector.collect_python_rules(prepared_source)];
		}
		return [...responsibilities, ...this.collect_typescript_rules(prepared_source)];
	}
}
