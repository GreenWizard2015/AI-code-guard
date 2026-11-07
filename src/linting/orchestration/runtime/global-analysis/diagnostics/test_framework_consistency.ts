import { PYTHON_UNITTEST_FRAMEWORK } from "src/constants";
import { PythonTestFileDeclarations } from "src/linting/orchestration/runtime/global-analysis/diagnostics/python_test_file_declarations";
import type { PythonTestFramework, TestFrameworkFile } from "src/model_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";

/** Responsibilities: _Python test frameworks classification_, _report framework inconsistencies_. **/
export class TestFrameworkConsistency {
	private readonly _rule: RuleContract;

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

	/** Responsibilities: _test-framework diagnostic dependency injection_. **/
	public constructor(rule: RuleContract) {
		this._rule = rule;
	}

	/** Responsibilities: _framework inconsistency reporting_. **/
	public violations(context: LintProjectContextContract): ViolationContract[] {
		const files = this.test_files(context);
		if (files.length === 0) {
			return [];
		}
		const counts = this.framework_counts(files);
		const unittest_count = counts.get(PYTHON_UNITTEST_FRAMEWORK);
		if (unittest_count !== undefined && unittest_count === files.length) {
			return [];
		}
		return files
			.filter((file) => file.framework !== PYTHON_UNITTEST_FRAMEWORK)
			.map((file) => this._rule.violation(file.source.relative_path, 1, { framework: PYTHON_UNITTEST_FRAMEWORK }));
	}

	/** Responsibilities: _Python test-file selection_. **/
	public test_files(context: LintProjectContextContract): TestFrameworkFile[] {
		const files: TestFrameworkFile[] = [];
		for (const source of context.files()) {
			if (source.language !== "python") {
				continue;
			}
			if (!source.file_name.test() || !source.file_name.value().endsWith(".py")) {
				continue;
			}
			const declarations = new PythonTestFileDeclarations(source);
			if (declarations.contains_tests()) {
				files.push({ source, framework: declarations.framework() });
			}
		}
		return files;
	}
}
