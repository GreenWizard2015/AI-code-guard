import { dirname, resolve } from "node:path";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type {
	RecoveredRuleContextInput,
	RecoveredSourceRecordInput,
} from "src/contracts/protocols/lint_runtime_protocols";
import { LintFileName } from "src/core/context/lint_file_name";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import type { SourceFileMapResolverCacheContract, SourceFileResolverContract } from "src/core/project-source/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptSourceRuleRuntime } from "src/linting/orchestration/runtime/typescript/type_script_source_rule_runtime";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ViolationValue } from "src/model/violation_value";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ProjectNames } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import type { SyntaxContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptSourceVerificationRequest } from "src/typescript_analysis_types";
import type ts from "typescript";

/** Responsibilities: _recovered source preparation_, _AST rule verification_, _diagnostic line mapping_. **/
export class TypeScriptCodingRules {
	private readonly _syntax: SyntaxContract;
	private readonly _project_names: ProjectNames;
	private readonly _map_cache: SourceFileMapResolverCacheContract;
	private readonly recovered_prefix = "function recovered() { ";
	private readonly recovered_suffix = " }";
	private readonly recovered_catch_keyword = "catch";
	private readonly recovered_catch = "try {} catch {}";

	/** Responsibilities: _recovered source analysis_. **/
	private analyze_recovered_source(input: RecoveredRuleContextInput): ViolationContract[] {
		const source_file = input.ast_file.source_file_node();
		const context = this.recovered_context(input);
		const verifier_registry = new ASTVerifierRegistry();
		verifier_registry.initialize();
		const verifier = verifier_registry.build(source_file.text);
		const verifier_request: TypeScriptSourceVerificationRequest = {
			source_root: source_file,
			context,
			stage_timer: input.stage_timer,
		};
		verifier.verify_source_file(verifier_request);
		return input.violations;
	}

	/** Responsibilities: _recovered source rule context_. **/
	private recovered_context(input: RecoveredRuleContextInput): RuleContextContract {
		const empty_sources = new Map<string, ts.SourceFile>();
		const source_resolver = this._map_cache.for_map(empty_sources);
		const source_io = new InMemoryProjectSourceIO(new Map());
		const exports_context = new TypeScriptModuleExportsContext(dirname(input.file), source_resolver, false, source_io);
		const record_input: RecoveredSourceRecordInput = {
			source_path: input.file,
			recovered_ast: input.ast_file,
			recovered_traversal: input.traversal,
		};
		const source_record = this.recovered_source_record(record_input, source_resolver);
		const runtime = new TypeScriptSourceRuleRuntime(
			source_record,
			this._project_names,
			exports_context.module_exports(),
		);
		return runtime.context_for_source(input.violations, input.ast_file.normalized(), input.stage_timer);
	}

	/** Responsibilities: _recovered source record_. **/
	private recovered_source_record(
		record_input: RecoveredSourceRecordInput,
		source_resolver: SourceFileResolverContract,
	): LintSourceRecordData {
		const source_file = record_input.recovered_ast.source_file_node();
		return {
			absolute_path: resolve(record_input.source_path),
			relative_path: record_input.source_path,
			file_name: new LintFileName(record_input.source_path),
			text: source_file.text,
			normalized_ast: record_input.recovered_ast.normalized(),
			language: TYPESCRIPT_LANGUAGE,
			typescript_ast: record_input.recovered_ast,
			source_resolver,
			traversal: record_input.recovered_traversal,
		};
	}

	/** Responsibilities: _recovered violation line assignment_. **/
	private recovered_line_violation(violation: ViolationContract, line: number): ViolationContract {
		return new ViolationValue({
			file: violation.file(),
			line,
			message: violation.message(),
			hint: violation.hint(),
			rule_id: violation.rule_id(),
			priority: violation.priority(),
		});
	}

	/** Responsibilities: _recovered source violation insertion_. **/
	private append_source_violations(
		collected: ViolationContract[],
		found: readonly ViolationContract[],
		line: number,
	): void {
		for (const violation of found) {
			if (violation.rule_id() !== "parse-error") {
				collected.push(this.recovered_line_violation(violation, line));
			}
		}
	}

	/** Responsibilities: _recovered rule analysis configuration_. **/
	public constructor(syntax: SyntaxContract, project_names: ProjectNames) {
		this._syntax = syntax;
		this._project_names = project_names;
		this._map_cache = new SourceFileMapCache();
	}

	/** Responsibilities: _source line rule wrapping_. **/
	public recover_rule_source(source: string): string {
		const trimmed = source.trim();
		if (!trimmed) {
			return "";
		}
		if (trimmed.includes(this.recovered_catch_keyword)) {
			return this.recovered_catch;
		}
		return `${this.recovered_prefix}${trimmed}${this.recovered_suffix}`;
	}

	/** Responsibilities: _recovered rule violation collection_. **/
	public append_recovered_rules(
		violations: ViolationContract[],
		file: string,
		text: string,
		stage_timer: LintStageTimerContract,
	): void {
		for (const [line, source] of this._syntax.split_lines(text).entries()) {
			const recovered = this.recover_rule_source(source);
			if (recovered.length === 0) {
				continue;
			}
			const ast_file = new TypeScriptAstFile(file, recovered);
			const input: RecoveredRuleContextInput = {
				violations: [],
				file,
				ast_file,
				traversal: new TypeScriptAstTraversal(ast_file.source_file_node()),
				stage_timer,
			};
			stage_timer.measure("typescript.ast-rule.recovered-source", () => {
				const found = this.analyze_recovered_source(input);
				this.append_source_violations(violations, found, line + 1);
			});
		}
	}
}
