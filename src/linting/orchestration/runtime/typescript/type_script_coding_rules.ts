import { dirname, resolve } from "node:path";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { RecoveredRuleContextInput } from "src/contracts/protocols/lint_runtime_protocols";
import { LintFileName } from "src/core/context/lint_file_name";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptSourceRuleRuntime } from "src/linting/orchestration/runtime/typescript/type_script_source_rule_runtime";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ViolationValue } from "src/model/violation_value";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ProjectNames } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import type { SyntaxContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptSourceVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _recover TypeScript rule source_, _recovered violations collection_. **/
export class TypeScriptCodingRules {
	private readonly _syntax: SyntaxContract;
	private readonly _project_names: ProjectNames;
	private readonly recovered_prefix = "function recovered() { ";
	private readonly recovered_suffix = " }";
	private readonly recovered_catch = "try {} catch {}";

	/** Responsibilities: _recovered source analysis_. **/
	private analyze_recovered_source(input: RecoveredRuleContextInput, recovered: string): ViolationContract[] {
		const source_file = input.ast_file.source_file_node();
		const context = this.recovered_context(input);
		const verifier_registry = new ASTVerifierRegistry();
		verifier_registry.initialize();
		const verifier = verifier_registry.build(recovered);
		const verifier_request: TypeScriptSourceVerificationRequest = {
			source_root: source_file,
			context,
			stage_timer: context.state().analysis.stage_timer,
		};
		verifier.verify_source_file(verifier_request);
		return input.violations;
	}

	/** Responsibilities: _recovered source rule context_. **/
	private recovered_context(input: RecoveredRuleContextInput): RuleContextContract {
		const exports_context = new TypeScriptModuleExportsContext(
			dirname(input.file),
			new Map(),
			false,
			new InMemoryProjectSourceIO(new Map()),
		);
		const source_file = input.ast_file.source_file_node();
		const source_record: LintSourceRecordData = {
			absolute_path: resolve(input.file),
			relative_path: input.file,
			file_name: new LintFileName(input.file),
			text: source_file.text,
			normalized_ast: input.ast_file.normalized(),
			language: TYPESCRIPT_LANGUAGE,
			typescript_ast: input.ast_file,
			source_resolver: new Map(),
			traversal: input.traversal,
		};
		const runtime = new TypeScriptSourceRuleRuntime(
			source_record,
			this._project_names,
			exports_context.module_exports(),
		);
		return runtime.context_for_source(input.violations, input.ast_file.normalized(), new LintStageTimer());
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

	/** Responsibilities: _aggregation recovered rules source_. **/
	public constructor(syntax: SyntaxContract, project_names: ProjectNames) {
		this._syntax = syntax;
		this._project_names = project_names;
	}

	/** Responsibilities: _aggregation recovered rules source_. **/
	public append_recovered_rules(violations: ViolationContract[], file: string, text: string): void {
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
			};
			for (const violation of this.analyze_recovered_source(input, recovered)) {
				violations.push(this.recovered_line_violation(violation, line + 1));
			}
		}
	}

	/** Responsibilities: _source line rule wrapping_. **/
	public recover_rule_source(source: string): string {
		const trimmed = source.trim();
		if (!trimmed) {
			return "";
		}
		if (trimmed.includes("catch")) {
			return this.recovered_catch;
		}
		return `${this.recovered_prefix}${trimmed}${this.recovered_suffix}`;
	}
}
