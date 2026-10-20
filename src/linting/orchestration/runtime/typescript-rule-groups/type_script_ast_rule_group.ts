import { ImportsRules } from "src/rules/imports_rules";
import { NamingSupport } from "src/rules/naming_support";
import { LeadingUnderscoreNaming } from "src/rules/leading_underscore_naming";
import { TypeScriptModuleDeclarationNaming } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_module_declaration_naming";
import { Syntax } from "src/parser/analysis/syntax";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptAstSpecialRules } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_ast_special_rules";
import type { TypeScriptAstSpecialRulesContract, TypeScriptRuleGroupContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import { TYPESCRIPT_CACHE_OWNER } from "src/constants";

/** Responsibilities: _AST rule collection_, _module declaration diagnostics_. **/
export class TypeScriptAstRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly imports_rules: ImportsRules;
	private readonly syntax: Syntax;
	private readonly leading_underscore_naming: LeadingUnderscoreNaming;
	private readonly naming_support: NamingSupport;
	private readonly module_declaration_naming: TypeScriptModuleDeclarationNaming;
	private readonly special_rules: TypeScriptAstSpecialRulesContract;

	/** Responsibilities: _module declaration diagnostics_. **/
	private append_module_violations(violations: ViolationContract[]): void {
		const { file_name, ast } = this.context;
		this.module_declaration_naming.append_constants(violations, file_name.value, ast.named_symbols);
		this.module_declaration_naming.append_variables(violations, file_name.value, ast.named_symbols);
	}

	/** Responsibilities: _AST rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.imports_rules = new ImportsRules();
		this.syntax = new Syntax();
		this.leading_underscore_naming = new LeadingUnderscoreNaming();
		this.naming_support = new NamingSupport(this.leading_underscore_naming);
		this.module_declaration_naming = new TypeScriptModuleDeclarationNaming();
		this.special_rules = new TypeScriptAstSpecialRules(context);
		this.context = context;
	}

	/** Responsibilities: _AST-derived diagnostics_. **/
	public append(violations: ViolationContract[]): void {
		this.imports_rules.append_import_violations(
			violations,
			this.context.file_name.value,
			this.context.ast.import_issues,
		);
		this.syntax.append_parse_issues(
			violations,
			this.context.file_name.value,
			this.context.ast.parse_issues,
			TYPESCRIPT_CACHE_OWNER,
		);
		this.naming_support.append_naming_violations(
			violations,
			this.context.file_name.value,
			this.context.ast.named_symbols,
			this.context.ast.classes,
			this.context.ast.type_declarations,
		);
		this.append_module_violations(violations);
		this.special_rules.append_error_rules(violations);
		this.special_rules.append_auxiliary_rules(violations);
	}
}
