import { TEST_PATH_SUFFIXES } from "src/constants";
import { ERROR_GROUPING_RULE_ID, TOP_LEVEL_CLASSES_RULE_ID } from "src/constants";
import type { ClassFieldFiles, NamedLine } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ClassSummaryOptions, PythonClassSummaryOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassReferenceMetric } from "src/rules/class_reference_metric";
import { ClassStructure } from "src/rules/class_structure";
import { PythonFields } from "src/rules/python_fields";
import type { LintProjectContextContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import type { PythonProjectImportContext } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";

/** Responsibilities: _class structural diagnostics_, _class metric coordination_. **/
export class ClassRules {
	private readonly _exception_rule_id: string;
	private readonly _top_rule_id: string;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _class_reference_metric: ClassReferenceMetric;
	private readonly _import_context: PythonProjectImportContext;

	/** Responsibilities: _exception grouping addition_. **/
	private append_exception_info(exception_options: ClassSummaryOptions): void {
		const class_structure = new ClassStructure(
			exception_options.file,
			exception_options.lines,
			exception_options.python,
			exception_options.parsed_indexes,
		);
		const indexes = class_structure.class_indexes();
		const exception_index = this.find_exception_index(exception_options, indexes);
		if (exception_index < 0) {
			return;
		}
		exception_options.violations.push(this.exception_grouping_info(exception_options.file, exception_index));
	}

	/** Responsibilities: _exception class lookup_. **/
	private find_exception_index(summary_options: ClassSummaryOptions, class_indexes: number[]): number {
		if (summary_options.has_module_functions) {
			return -1;
		}
		const exception_indexes = class_indexes.filter((index) => {
			const line = summary_options.lines[index];
			if (line === undefined) {
				return false;
			}
			return this.is_exception_class(line, summary_options.python);
		});
		if (exception_indexes.length === 1) {
			const exception_index = exception_indexes.at(0);
			if (exception_index === undefined) {
				return -1;
			}
			return exception_index;
		}
		return -1;
	}

	/** Responsibilities: _exception diagnostic creation_. **/
	private exception_grouping_info(source_path: string, index: number): ViolationContract {
		const line = index + 1;
		const rule = new DiagnosticRule(this._exception_rule_id);
		return rule.violation(source_path, line);
	}

	/** Responsibilities: _exception declarations classification_. **/
	private is_exception_class(line: string, python: boolean): boolean {
		if (python) {
			return /\bclass\s+\w+\s*\([^)]*(?:Exception|BaseException|[A-Z]\w*Error)\b[^)]*\)/u.test(line);
		}
		return /\bclass\s+\w+\s+extends\s+(?:\w+\.)?Error\b/u.test(line);
	}

	/** Responsibilities: _class diagnostic creation_. **/
	private single_class_violation(source_file: string, class_indexes: number[]): ViolationContract {
		const second_class_index = class_indexes.at(1);
		if (second_class_index === undefined) {
			throw new Error("A multiple-class diagnostic requires at least two classes.");
		}
		const line = second_class_index + 1;
		const rule = new DiagnosticRule(this._top_rule_id);
		return rule.violation(source_file, line, { count: String(class_indexes.length) });
	}

	/** Responsibilities: _implementation class indexes_. **/
	private implementation_class_indexes(summary: ClassSummaryOptions, indexes: number[]): number[] {
		return indexes.filter((index) => {
			const line = summary.lines[index];
			return line !== undefined && !this.is_exception_class(line, summary.python);
		});
	}

	/** Responsibilities: _class summaries addition_. **/
	private append_class_summary(summary_options: ClassSummaryOptions): void {
		this.append_exception_info(summary_options);
		const class_structure = new ClassStructure(
			summary_options.file,
			summary_options.lines,
			summary_options.python,
			summary_options.parsed_indexes,
		);
		const class_indexes = this.implementation_class_indexes(summary_options, class_structure.class_indexes());
		if (class_indexes.length <= 1) {
			return;
		}
		summary_options.violations.push(this.single_class_violation(summary_options.file, class_indexes));
	}

	/** Responsibilities: _Python nested type diagnostics_. **/
	private is_nested_type(line: string): boolean {
		let indentation = 0;
		while (indentation < line.length && (line[indentation] === " " || line[indentation] === "\t")) {
			indentation += 1;
		}
		return indentation > 0 && !line.slice(indentation).startsWith("class ");
	}

	/** Responsibilities: _nested type declaration locations_. **/
	private nested_type_indexes(lines: readonly string[], declarations: readonly NamedLine[]): number[] {
		const indexes: number[] = [];
		for (const declaration of declarations) {
			const line = lines[declaration.line];
			if (line !== undefined && this.is_nested_type(line)) {
				indexes.push(declaration.line);
			}
		}
		return indexes;
	}

	/** Responsibilities: _Python nested type diagnostics_. **/
	private append_python_types(
		file: string,
		lines: readonly string[],
		declarations: readonly NamedLine[],
		violations: ViolationContract[],
	): void {
		const indexes = this.nested_type_indexes(lines, declarations);
		const first_index = indexes.at(0);
		if (first_index === undefined) {
			return;
		}
		const rule = new DiagnosticRule("nested-type");
		violations.push(rule.violation(file, first_index + 1, { count: String(indexes.length) }));
	}

	/** Responsibilities: _shared Python project state_. **/
	public constructor(import_context: PythonProjectImportContext) {
		this._exception_rule_id = ERROR_GROUPING_RULE_ID;
		this._top_rule_id = TOP_LEVEL_CLASSES_RULE_ID;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._class_reference_metric = new ClassReferenceMetric(this._test_path_syntax);
		this._import_context = import_context;
	}

	/** Responsibilities: _Python-only contextual class-field diagnostics_. **/
	public python_context_fields(input: ClassFieldFiles, context: LintProjectContextContract): ViolationContract[] {
		const scanner = new PythonFields(this._import_context);
		const context_sources = context.files();
		const references = this._class_reference_metric.language_class_refs(context_sources, "python");
		return [...references, ...scanner.collect_fields(input, context_sources)];
	}

	/** Responsibilities: _Python class diagnostics addition_. **/
	public append_python_classes(options: PythonClassSummaryOptions): void {
		const {
			violations,
			file,
			lines,
			parsed_indexes,
			has_module_functions,
			has_implementation_classes,
			type_declarations,
		} = options;
		const class_structure = new ClassStructure(file, lines, true, parsed_indexes);
		this.append_python_types(file, lines, type_declarations, violations);
		if (!has_implementation_classes) {
			return;
		}
		class_structure.append_nested_class(violations);
		this.append_class_summary({ violations, file, lines, python: true, parsed_indexes, has_module_functions });
	}
}
