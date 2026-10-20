import ts from "typescript";
import type { LintFileNameContract, LintSourceRecord } from "src/source_types";
import type { NamedLine } from "src/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { RemainingViolationOptions } from "src/model/types/types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { SingletonCollector } from "src/linting/orchestration/runtime/singleton_collector";
import type { CodingRuleLinterContract } from "src/shared_services_protocols";
import { FileRemainingPlacementRules } from "src/linting/orchestration/runtime/file_remaining_placement_rules";
import { FileRemainingTextRules } from "src/linting/orchestration/runtime/file_remaining_text_rules";
import { Reexports } from "src/linting/orchestration/runtime/python/reexports/reexports";
import { TypeScriptReexports } from "src/linting/orchestration/runtime/python/reexports/type_script_reexports";
import { ImportFanOut } from "src/linting/orchestration/runtime/global-rules/import_fan_out";
import { FunctionPlacementRules } from "src/linting/orchestration/runtime/test-targets/function_placement_rules";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _remaining violation collection_, _language-specific rule collection_. **/
export class FileRemainingViolationCollector {
	private readonly placement_rules: FileRemainingPlacementRules;
	private readonly text_rules: FileRemainingTextRules;

	/** Responsibilities: _collection singleton violations normalization_. **/
	private collect_singletons(
		source: LintSourceRecord,
		file: string,
		text: string,
		python: boolean,
	): ViolationContract[] {
		const local_class_names = new Set(source.normalized_ast.classes.map((node) => node.name));
		let source_file: ts.SourceFile;
		if (source.typescript()) {
			source_file = source.typescript_ast.source_file_node();
		} else {
			source_file = ts.createSourceFile(file, "", ts.ScriptTarget.Latest, true);
		}
		const singleton_collector = new SingletonCollector(
			file,
			text,
			local_class_names,
			source.normalized_ast,
			source_file,
		);
		return singleton_collector.collect_violations(python);
	}

	/** Responsibilities: _retrieval normalization source record_. **/
	private source_file(source: LintSourceRecord, file: string): ts.SourceFile {
		if (source.typescript()) {
			return source.typescript_ast.source_file_node();
		}
		return ts.createSourceFile(file, "", ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _aggregation coding-rule violations source_. **/
	private append_coding_rules(options: RemainingViolationOptions, coding_rule_linter: CodingRuleLinterContract): void {
		const source_ast = new SourceFileAst(
			{ file: options.file, text: options.text },
			options.source.normalized_ast,
			this.source_file(options.source, options.file),
			options.source.source_resolver,
			options.source.traversal,
		);
		if (options.python) {
			options.violations.push(...coding_rule_linter.lint_python(source_ast));
			return;
		}
		options.violations.push(...coding_rule_linter.lint_typescript(source_ast, options.stage_timer));
	}

	/** Responsibilities: _function placement stage_. **/
	private append_function_placements(options: RemainingViolationOptions, language: string): void {
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.function-placement`, () =>
			this.placement_rules.append_function_placements(
				options.violations,
				options.file,
				options.source.normalized_ast.functions,
			),
		);
	}

	/** Responsibilities: _common remaining violation stages_. **/
	private append_common(options: RemainingViolationOptions, coding_rule_linter: CodingRuleLinterContract): void {
		let language = TYPESCRIPT_LANGUAGE;
		if (options.python) {
			language = PYTHON_LANGUAGE;
		}
		this.placement_rules.append_imports(
			options.violations,
			options.file,
			options.source,
			this.source_file(options.source, options.file),
		);
		this.append_function_placements(options, language);
		this.text_rules.append(options);
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.coding-rules`, () =>
			this.append_coding_rules(options, coding_rule_linter),
		);
	}

	/** Responsibilities: _metric remaining violation stages_. **/
	private append_metrics(options: RemainingViolationOptions): void {
		let language = TYPESCRIPT_LANGUAGE;
		if (options.python) {
			language = PYTHON_LANGUAGE;
		}
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.type-declarations`, () =>
			this.append_type_declarations(
				options.violations,
				options.file,
				options.source.file_name,
				options.source.normalized_ast.type_declarations,
			),
		);
	}

	/** Responsibilities: _functions-file type declaration violations_. **/
	private append_type_declarations(
		violations: ViolationContract[],
		file: string,
		file_name: LintFileNameContract,
		declarations: readonly NamedLine[],
	): void {
		if (!file_name.is_functions_file || file_name.test()) {
			return;
		}
		const rule = new DiagnosticRule("functions-file-type-declaration");
		for (const declaration of declarations) {
			violations.push(rule.violation(file, declaration.line + 1));
		}
	}

	/** Responsibilities: _remaining common analysis_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.placement_rules = new FileRemainingPlacementRules(new ImportFanOut(), new FunctionPlacementRules());
		this.text_rules = new FileRemainingTextRules(new Reexports(new TypeScriptReexports()));
	}
	/** Responsibilities: _public operation_. **/
	public append(options: RemainingViolationOptions, coding_rule_linter: CodingRuleLinterContract): void {
		this.append_common(options, coding_rule_linter);
		this.append_metrics(options);
	}

	/** Responsibilities: _remaining language analysis_. **/
	public append_language(options: RemainingViolationOptions): void {
		let language = TYPESCRIPT_LANGUAGE;
		if (options.python) {
			language = PYTHON_LANGUAGE;
		}
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.singletons`, () =>
			options.violations.push(...this.collect_singletons(options.source, options.file, options.text, options.python)),
		);
	}
}
