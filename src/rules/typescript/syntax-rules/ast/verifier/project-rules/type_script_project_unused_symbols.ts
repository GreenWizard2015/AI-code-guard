import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { TypeScriptProjectAnalysisContract } from "src/ast_verifier_protocols";
import { TEST_PATH_SUFFIXES } from "src/constants";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { UnusedCode } from "src/core/project-source/unused_code";
import { UNUSED_SYMBOL_KIND } from "src/core/types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptProjectRuleCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_cache";
import type { LintSourceRecordData } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import { UnusedSymbolRules } from "src/unused_symbol_rules";
import ts from "typescript";

/** Responsibilities: _unused symbol analysis_, _source file analysis_. **/
export class TypeScriptProjectUnusedSymbols implements ASTSourceRuleContract, TypeScriptProjectAnalysisContract {
	private readonly _cache: TypeScriptProjectRuleCache;

	/** Responsibilities: _unused symbol rule diagnostics_. **/
	private symbol_violations(
		scope: ProjectSourceAnalysisOptions,
		sources: readonly LintSourceRecordData[],
	): ViolationContract[] {
		const rules = new UnusedSymbolRules(
			new TestPathSyntax(TEST_PATH_SUFFIXES),
			new Map([
				[UNUSED_SYMBOL_KIND.Class, new DiagnosticRule("unused-class")],
				[UNUSED_SYMBOL_KIND.Constant, new DiagnosticRule("unused-constant")],
				[UNUSED_SYMBOL_KIND.Type, new DiagnosticRule("unused-type")],
				[UNUSED_SYMBOL_KIND.PublicField, new DiagnosticRule("unused-public-field")],
				[UNUSED_SYMBOL_KIND.ModuleVariable, new DiagnosticRule("unused-module-variable")],
			]),
			new DiagnosticRule("test-only-usage"),
			sources,
			scope.scanner,
		);
		const typescript_files = new Set(sources.map((source) => source.relative_path));
		return rules.collect().filter((violation) => typescript_files.has(violation.file()));
	}

	/** Responsibilities: _unused source diagnostics_. **/
	private source_violations(
		scope: ProjectSourceAnalysisOptions,
		sources: readonly LintSourceRecordData[],
	): ViolationContract[] {
		const typescript_files = new Set(sources.map((source) => source.relative_path));
		const typescript_absolute_files = new Set(sources.map((source) => source.absolute_path));
		const unused_code = new UnusedCode();
		const scanned_files = scope.scanner.files().filter((file) => typescript_absolute_files.has(file));
		return unused_code
			.collect_scanner_violations(scope.root, scope.scanner, scanned_files)
			.filter((violation) => typescript_files.has(violation.file()));
	}

	/** Responsibilities: _unused-symbol rule initialization_. **/
	public constructor() {
		this._cache = new TypeScriptProjectRuleCache();
	}

	/** Responsibilities: _unused-symbol rule activation_. **/
	public active_for(): boolean {
		return true;
	}

	/** Responsibilities: _unused symbol reporting_. **/
	public verify(symbol_request: TypeScriptNodeVerificationRequest): void {
		if (ts.isSourceFile(symbol_request.node)) {
			this._cache.append_for_source(symbol_request, this);
		}
	}

	/** Responsibilities: _project unused-symbol violation collection_. **/
	public collect_project_violations(symbol_request: TypeScriptNodeVerificationRequest): ViolationContract[] {
		const rule_scope = symbol_request.context.state().project.rule_scope;
		if (!rule_scope.project_scope()) {
			return [];
		}
		const scope = rule_scope.project_analysis();
		const sources = rule_scope.source_files(TYPESCRIPT_LANGUAGE);
		return [...this.symbol_violations(scope, sources), ...this.source_violations(scope, sources)];
	}
}
