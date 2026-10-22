import { ClassReferenceMetric } from "src/rules/class_reference_metric";
import { ClassStructure } from "src/rules/class_structure";
import { PythonClassFieldScanner } from "src/rules/python_class_field_scanner";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptClassFieldRules } from "src/model/type_script_class_field_rules";
import { NestedTypeStructure } from "src/rules/nested_type_structure";
import type { LintSourceRecord, PythonProjectImportContext } from "src/source_types";
import type { ClassSummaryOptions, PythonClassSummaryOptions } from "src/model/types/types";
import ts from "typescript";
import { TestPathSyntax } from "src/test_path_syntax";
import { ERROR_GROUPING_RULE_ID, TOP_LEVEL_CLASSES_RULE_ID } from "src/constants";
import type { ClassFieldFiles } from "src/types";

/** Responsibilities: _class structural diagnostics_, _class metric coordination_. **/
export class ClassRules {
	private readonly exception_rule_id = ERROR_GROUPING_RULE_ID;
	private readonly top_rule_id = TOP_LEVEL_CLASSES_RULE_ID;
	private readonly nested_type_structure: NestedTypeStructure;
	private readonly test_path_syntax: TestPathSyntax;
	private readonly class_reference_metric: ClassReferenceMetric;
	private readonly import_context: PythonProjectImportContext;

	/** Responsibilities: _exception grouping addition_. **/
	private append_exception_info(options: ClassSummaryOptions): void {
		const class_structure = new ClassStructure();

		const indexes = class_structure.class_indexes_for(
			options.file,
			options.lines,
			options.python,
			options.parsed_indexes,
		);
		const exception_index = this.find_exception_index(options, indexes);
		if (exception_index < 0) {
			return;
		}
		options.violations.push(this.exception_grouping_info(options.file, exception_index));
	}

	/** Responsibilities: _top-level functions detection_. **/
	private typescript_functions(source_file: ts.SourceFile): boolean {
		return source_file.statements.some((statement) => {
			if (ts.isFunctionDeclaration(statement)) {
				return statement.name !== undefined;
			}
			if (!ts.isVariableStatement(statement)) {
				return false;
			}
			return statement.declarationList.declarations.some((declaration) => {
				const initializer = declaration.initializer;
				return initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
			});
		});
	}

	/** Responsibilities: _exception class lookup_. **/
	private find_exception_index(options: ClassSummaryOptions, indexes: number[]): number {
		if (options.has_module_functions) {
			return -1;
		}
		const exception_indexes = indexes.filter((index) => this.is_exception_class(options.lines[index], options.python));
		if (exception_indexes.length === 1) {
			return exception_indexes[0];
		}
		return -1;
	}

	/** Responsibilities: _exception diagnostic creation_. **/
	private exception_grouping_info(file: string, index: number): ViolationContract {
		const line = index + 1;
		const rule = new DiagnosticRule(this.exception_rule_id);
		return rule.violation(file, line);
	}

	/** Responsibilities: _exception declarations classification_. **/
	private is_exception_class(line: string, python: boolean): boolean {
		if (python) {
			return /\bclass\s+\w+\s*\([^)]*(?:Exception|BaseException|[A-Z]\w*Error)\b[^)]*\)/u.test(line);
		}
		return /\bclass\s+\w+\s+extends\s+(?:\w+\.)?Error\b/u.test(line);
	}

	/** Responsibilities: _class diagnostic creation_. **/
	private single_class_violation(file: string, indexes: number[]): ViolationContract {
		const line = indexes[1] + 1;
		const rule = new DiagnosticRule(this.top_rule_id);
		return rule.violation(file, line, { count: String(indexes.length) });
	}

	/** Responsibilities: _class summaries addition_. **/
	private append_class_summary(options: ClassSummaryOptions): void {
		this.append_exception_info(options);
		const class_structure = new ClassStructure();
		const indexes = class_structure.class_indexes_for(
			options.file,
			options.lines,
			options.python,
			options.parsed_indexes,
		);
		const class_indexes = indexes.filter((index) => !this.is_exception_class(options.lines[index], options.python));
		if (class_indexes.length <= 1) {
			return;
		}
		options.violations.push(this.single_class_violation(options.file, class_indexes));
	}

	/** Responsibilities: _field violations merging_. **/
	private collect_fields(
		context_files: readonly LintSourceRecord[],
		python_violations: ViolationContract[],
		typescript_violations: ViolationContract[],
	): ViolationContract[] {
		const violations = this.class_reference_metric.collect_class_refs(context_files);
		violations.push(...python_violations);
		violations.push(...typescript_violations);
		return violations;
	}

	/** Responsibilities: _shared Python project state_. **/
	public constructor(import_context: PythonProjectImportContext) {
		this.nested_type_structure = new NestedTypeStructure();
		this.test_path_syntax = new TestPathSyntax();
		this.class_reference_metric = new ClassReferenceMetric(this.test_path_syntax);
		this.import_context = import_context;
	}

	/** Responsibilities: _local field violations collection_. **/
	public collect_field_violations(input: ClassFieldFiles): ViolationContract[] {
		const scanner = new PythonClassFieldScanner(this.import_context);
		const class_fields = new TypeScriptClassFieldRules();
		return this.collect_fields(
			[],
			scanner.collect_class_fields(input.files, input.repo_root),
			class_fields.collect_fields(input.files, input.repo_root),
		);
	}

	/** Responsibilities: _contextual field violations collection_. **/
	public collect_context_fields(
		input: ClassFieldFiles,
		context: LintProjectContextContract,
		stage_timer: LintStageTimerContract,
	): ViolationContract[] {
		const scanner = new PythonClassFieldScanner(this.import_context);
		const class_fields = new TypeScriptClassFieldRules();
		const context_sources = context.files();
		if (context_sources.length === 0) {
			return this.collect_field_violations(input);
		}
		const class_reference_violations = stage_timer.measure("global-analysis.class-fields.class-references", () =>
			this.class_reference_metric.collect_class_refs(context_sources),
		);
		const python_violations = stage_timer.measure("global-analysis.class-fields.python-fields", () =>
			scanner.collect_context_fields(input.files, input.repo_root, context),
		);
		const typescript_violations = stage_timer.measure("global-analysis.class-fields.typescript-fields", () =>
			class_fields.context_fields(input.files, input.repo_root, context),
		);
		return [...class_reference_violations, ...python_violations, ...typescript_violations];
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
		const class_structure = new ClassStructure();

		this.nested_type_structure.append_python_types(violations, file, lines, type_declarations);
		if (!has_implementation_classes) {
			return;
		}
		class_structure.append_nested_class(violations, file, lines, true);
		this.append_class_summary({ violations, file, lines, python: true, parsed_indexes, has_module_functions });
	}

	/** Responsibilities: _TypeScript class diagnostics addition_. **/
	public append_typescript_classes(
		violations: ViolationContract[],
		file: string,
		lines: string[],
		source_file: ts.SourceFile,
		parsed_indexes: number[],
	): void {
		const class_structure = new ClassStructure();
		class_structure.append_nested_class(violations, file, lines, false, source_file);
		this.nested_type_structure.append_nested_types(violations, file, source_file);
		this.append_class_summary({
			violations,
			file,
			lines,
			python: false,
			parsed_indexes,
			has_module_functions: this.typescript_functions(source_file),
		});
	}
}
