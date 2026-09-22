import { ImportsRules } from 'src/bridge/ts/rules/imports-rules';
import { NamingSupport } from 'src/bridge/ts/rules/naming-support';
import { Syntax } from 'src/syntax';
import type { Violation } from 'src/protocols';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _import rules application_, _syntax rules application_, _naming rules application_. **/
export class TypeScriptAstRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContext;
	private readonly imports_rules = new ImportsRules();
	private readonly syntax = new Syntax();
	private readonly naming_support = new NamingSupport();

	/** Responsibilities: _AST rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.context = context;
	}

	/** Responsibilities: _AST-derived violations addition_. **/
	public append(violations: Violation[]): void {
		this.imports_rules.append_import_violations(
			violations,
			this.context.file_name.value,
			this.context.ast.import_issues,
		);
		this.syntax.append_parse_issues(
			violations,
			this.context.file_name.value,
			this.context.ast.parse_issues,
			'typescript',
		);
		this.naming_support.append_naming_violations(
			violations,
			this.context.file_name.value,
			this.context.ast.named_symbols,
			this.context.ast.classes,
			this.context.ast.type_declarations,
		);
	}
}
