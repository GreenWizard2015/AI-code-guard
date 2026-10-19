import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { LintProjectContextContract, ViolationContract } from "src/protocols";
import type { LintSourceRecord } from "src/types";
import type { PythonTestFramework, TestFrameworkFile } from "src/model/types/types";
import { PYTHON_UNITTEST_FRAMEWORK } from "src/linting/orchestration/runtime/test-targets/constants";
import { PythonTestFrameworkIdentity } from "src/linting/orchestration/runtime/test-targets/python_test_framework_identity";

/** Responsibilities: _Python test frameworks classification_, _report framework inconsistencies_. **/
export class TestFrameworkConsistency {
	private readonly rule: DiagnosticRule;

	/** Responsibilities: _classification framework usage source_. **/
	private framework(source: LintSourceRecord): PythonTestFramework {
		const test_classes = source.normalized_ast.classes.filter((node) =>
			node.methods.some((method) => method.name.startsWith("test_") && !method.decorators.includes("fixture")),
		);
		const identity = new PythonTestFrameworkIdentity(
			source.normalized_ast.reference_aliases,
			source.normalized_ast.python_imports,
		);
		if (test_classes.some((node) => node.base_class_names.some((name) => identity.unittest_base(name)))) {
			return PYTHON_UNITTEST_FRAMEWORK;
		}
		return "pytest";
	}

	/** Responsibilities: _Python test files identification_. **/
	private is_test_file(source: LintSourceRecord): boolean {
		if (!source.python()) {
			return false;
		}
		if (!source.file_name.test() || !source.file_name.value.endsWith(".py")) {
			return false;
		}
		if (source.normalized_ast.functions.some((node) => node.name.startsWith("test_"))) {
			return true;
		}
		return source.normalized_ast.classes.some((node) =>
			node.methods.some((method) => method.name.startsWith("test_") && !method.decorators.includes("fixture")),
		);
	}

	/** Responsibilities: _framework count_. **/
	private framework_counts(files: readonly TestFrameworkFile[]): ReadonlyMap<PythonTestFramework, number> {
		const counts = new Map<PythonTestFramework, number>();
		for (const file of files) {
			const current_count = counts.get(file.framework);
			if (current_count === undefined) {
				counts.set(file.framework, 1);
				continue;
			}
			counts.set(file.framework, current_count + 1);
		}
		return counts;
	}

	/** Responsibilities: _test-framework consistency violations collection_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.rule = new DiagnosticRule("python-test-framework-consistency");
	}
	/** Responsibilities: _public operation_. **/
	public violations(context: LintProjectContextContract): ViolationContract[] {
		const files = this.test_files(context);
		if (files.length === 0) {
			return [];
		}
		const counts = this.framework_counts(files);
		const unittest_count = counts.get(PYTHON_UNITTEST_FRAMEWORK);
		if (unittest_count !== undefined) {
			if (unittest_count === files.length) {
				return [];
			}
		}
		return files
			.filter((file) => file.framework !== PYTHON_UNITTEST_FRAMEWORK)
			.map((file) => this.rule.violation(file.source.relative_path, 1, { framework: PYTHON_UNITTEST_FRAMEWORK }));
	}

	/** Responsibilities: _Python test files identification_. **/
	public test_files(context: LintProjectContextContract): TestFrameworkFile[] {
		const files: TestFrameworkFile[] = [];
		for (const source of context.files()) {
			if (this.is_test_file(source)) {
				files.push({ source, framework: this.framework(source) });
			}
		}
		return files;
	}
}
