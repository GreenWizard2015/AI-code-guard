import { PYTHON_LANGUAGE, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { SourceFileAst } from "src/linting/orchestration/runtime/file_linting/source_file_ast";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { NamedLine } from "src/model/ast/normalized_ast_types";
import type {
	FileRemainingTextRulesContract,
	FunctionPlacementRulesContract,
	ImportFanOutContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { LintFileNameContract } from "src/core/support/protocols";
import type { RemainingViolationOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CodingRuleLinterContract } from "src/shared_services_protocols";
import type { FileRemainingViolationContext } from "src/linting/orchestration/runtime/file_linting/types";
import { SingletonCollector } from "src/rules/singleton_collector";
import ts from "typescript";

/** Responsibilities: _per-file remaining violation stages_, _source AST reuse_. **/
export class FileRemainingViolationCollector {
	private readonly _options: RemainingViolationOptions;
	private readonly _import_fan_out: ImportFanOutContract;
	private readonly _function_placement_rules: FunctionPlacementRulesContract;
	private readonly _text_rules: FileRemainingTextRulesContract;
	private readonly _coding_rule_linter: CodingRuleLinterContract;
	private readonly _entry_point: boolean;
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _Python source type declarations_. **/
	private append_type_declarations(
		violations: ViolationContract[],
		file: string,
		file_name: LintFileNameContract,
		declarations: readonly NamedLine[],
	): void {
		if (!file_name.functions_file() || file_name.test()) {
			return;
		}
		const rule = new DiagnosticRule("functions-file-type-declaration");
		for (const declaration of declarations) {
			violations.push(rule.violation(file, declaration.line + 1));
		}
	}

	/** Responsibilities: _remaining file language_. **/
	private language(): string {
		if (this._options.python) {
			return PYTHON_LANGUAGE;
		}
		return this._options.source.language;
	}

	/** Responsibilities: _coding-rule issue collection_. **/
	private append_coding_rules(): void {
		const { options, coding_rule_linter, source_file } = {
			options: this._options,
			coding_rule_linter: this._coding_rule_linter,
			source_file: this._source_file,
		};
		const source = options.source;
		const source_ast = new SourceFileAst(
			{ file: options.file, text: options.text },
			source.normalized_ast,
			source_file,
			source.source_resolver,
			source.traversal,
		);
		if (options.python) {
			options.violations.push(...coding_rule_linter.lint_python(source_ast, options.stage_timer));
			return;
		}
		options.violations.push(...coding_rule_linter.lint_typescript(source_ast, options.stage_timer));
	}

	/** Responsibilities: _free function placement_. **/
	private append_function_placements(): void {
		const options = this._options;
		const source = options.source;
		options.stage_timer.measure(
			`file-analysis.${this.language()}.post-remaining.free-function-outside-entry-point`,
			() =>
				this._function_placement_rules.append(
					options.violations,
					options.file,
					source.normalized_ast.source.functions,
					this._entry_point,
				),
		);
	}

	/** Responsibilities: _Python singleton findings_. **/
	private append_singleton_findings(): void {
		const options = this._options;
		options.stage_timer.measure(`file-analysis.${this.language()}.post-remaining.singletons`, () =>
			options.stage_timer.measure("rule.singleton.python", () => {
				const normalized_ast = options.source.normalized_ast;
				const local_class_names = new Set(normalized_ast.source.classes.map((node) => node.identity.name));
				const collector = new SingletonCollector(options.file, local_class_names, normalized_ast, this._source_file);
				options.violations.push(...collector.collect_violations(options.python));
			}),
		);
	}

	/** Responsibilities: _remaining stage initialization_, _source AST reuse_. **/
	public constructor(context: FileRemainingViolationContext) {
		const { options, dependencies, entry_point } = context;
		this._options = options;
		this._import_fan_out = dependencies.import_fan_out;
		this._function_placement_rules = dependencies.function_placement_rules;
		this._text_rules = dependencies.text_rules;
		this._coding_rule_linter = dependencies.coding_rule_linter;
		this._entry_point = entry_point;
		if (options.source.language === TYPESCRIPT_CACHE_OWNER) {
			this._source_file = options.source.typescript_ast.source_file_node();
		} else {
			this._source_file = ts.createSourceFile(options.file, "", ts.ScriptTarget.Latest, true);
		}
	}

	/** Responsibilities: _common remaining violation stages_. **/
	public append_common_rules(): void {
		if (this._options.python) {
			this._options.stage_timer.measure("rule.import-fan-out.python", () =>
				this._import_fan_out.append(this._options.violations, this._options.source),
			);
			this.append_function_placements();
		}
		this._text_rules.append(this._options);
		const coding_rules_stage = `file-analysis.${this.language()}.post-remaining.coding-rules`;
		this._options.stage_timer.measure(coding_rules_stage, () =>
			this._options.stage_timer.measure(`${coding_rules_stage}.file:${this._options.file}`, () =>
				this.append_coding_rules(),
			),
		);
	}

	/** Responsibilities: _Python singleton stage_. **/
	public append_singletons(): void {
		if (this._options.python) {
			this.append_singleton_findings();
		}
	}

	/** Responsibilities: _Python metric stage_. **/
	public append_metric_rules(): void {
		if (!this._options.python) {
			return;
		}
		const options = this._options;
		const { references } = options.source.normalized_ast;
		options.stage_timer.measure(`file-analysis.${this.language()}.post-remaining.type-declarations`, () =>
			options.stage_timer.measure("rule.functions-file-type-declaration.python", () =>
				this.append_type_declarations(
					options.violations,
					options.file,
					options.source.file_name,
					references.type_declarations,
				),
			),
		);
	}
}
