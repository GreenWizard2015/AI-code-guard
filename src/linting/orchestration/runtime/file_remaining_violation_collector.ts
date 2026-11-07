import { PYTHON_LANGUAGE, TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_LANGUAGE } from "src/constants";
import type {
	FileRemainingTextRulesContract,
	FunctionPlacementRulesContract,
	ImportFanOutContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { LintFileNameContract } from "src/core/support/protocols";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import type { NamedLine } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RemainingViolationOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CodingRuleLinterContract } from "src/shared_services_protocols";
import { SingletonCollector } from "src/singleton_collector";
import ts from "typescript";

/** Responsibilities: _remaining violation collection_, _language-specific rule collection_. **/
export class FileRemainingViolationCollector {
	private readonly _options: RemainingViolationOptions;
	private readonly _import_fan_out: ImportFanOutContract;
	private readonly _function_placement_rules: FunctionPlacementRulesContract;
	private readonly _text_rules: FileRemainingTextRulesContract;
	private readonly _coding_rule_linter: CodingRuleLinterContract;

	/** Responsibilities: _remaining violation context creation_. **/
	private language(): string {
		if (this._options.python) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}

	/** Responsibilities: _source file resolution_. **/
	private source_file(): ts.SourceFile {
		const source = this._options.source;
		if (source.language === TYPESCRIPT_CACHE_OWNER) {
			return source.typescript_ast.source_file_node();
		}
		return ts.createSourceFile(this._options.file, "", ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _aggregation coding-rule violations source_. **/
	private append_coding_rules(): void {
		const options = this._options;
		const source = options.source;
		const source_ast = new SourceFileAst(
			{ file: options.file, text: options.text },
			source.normalized_ast,
			this.source_file(),
			source.source_resolver,
			source.traversal,
		);
		if (options.python) {
			options.violations.push(...this._coding_rule_linter.lint_python(source_ast));
			return;
		}
		options.violations.push(...this._coding_rule_linter.lint_typescript(source_ast, options.stage_timer));
	}

	/** Responsibilities: _function placement stage_. **/
	private append_function_placements(): void {
		const options = this._options;
		const source = options.source;
		const normalized_ast = source.normalized_ast;
		options.stage_timer.measure(`file-analysis.${this.language()}.post-remaining.function-placement`, () =>
			this._function_placement_rules.append(options.violations, options.file, normalized_ast.source.functions),
		);
	}

	/** Responsibilities: _functions-file type declaration violations_. **/
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

	/** Responsibilities: _remaining rule dependencies_. **/
	public constructor(
		options: RemainingViolationOptions,
		import_fan_out: ImportFanOutContract,
		function_placement_rules: FunctionPlacementRulesContract,
		text_rules: FileRemainingTextRulesContract,
		coding_rule_linter: CodingRuleLinterContract,
	) {
		this._options = options;
		this._import_fan_out = import_fan_out;
		this._function_placement_rules = function_placement_rules;
		this._text_rules = text_rules;
		this._coding_rule_linter = coding_rule_linter;
	}

	/** Responsibilities: _common remaining violation stages_. **/
	public append_common_rules(): void {
		const options = this._options;
		const source = options.source;
		if (options.python) {
			this._import_fan_out.append(options.violations, source);
			this.append_function_placements();
		}
		this._text_rules.append(options);
		options.stage_timer.measure(`file-analysis.${this.language()}.post-remaining.coding-rules`, () =>
			this.append_coding_rules(),
		);
	}

	/** Responsibilities: _singleton violation collection_. **/
	public append_singletons(): void {
		const options = this._options;
		if (!options.python) {
			return;
		}
		const normalized_ast = options.source.normalized_ast;
		const local_class_names = new Set(normalized_ast.source.classes.map((node) => node.identity.name));
		const collector = new SingletonCollector(options.file, local_class_names, normalized_ast, this.source_file());
		options.stage_timer.measure(`file-analysis.${this.language()}.post-remaining.singletons`, () =>
			options.violations.push(...collector.collect_violations(options.python)),
		);
	}

	/** Responsibilities: _metric remaining violation stages_. **/
	public append_metric_rules(): void {
		const options = this._options;
		if (!options.python) {
			return;
		}
		const source = options.source;
		const normalized_ast = source.normalized_ast;
		options.stage_timer.measure(`file-analysis.${this.language()}.post-remaining.type-declarations`, () =>
			this.append_type_declarations(
				options.violations,
				options.file,
				source.file_name,
				normalized_ast.references.type_declarations,
			),
		);
	}
}
