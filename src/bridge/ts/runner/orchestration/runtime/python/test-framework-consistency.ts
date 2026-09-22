import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { LintProjectContext, Violation } from 'src/protocols';
import type { LintSourceRecord } from 'src/types';
import { TestFrameworkCounts } from 'src/bridge/ts/runner/orchestration/runtime/python/test-framework-counts';
import type { PythonTestFramework, TestFrameworkFile } from 'src/bridge/ts/runner/orchestration/runtime/python/types';

/** Responsibilities: _Python test frameworks classification_, _report framework inconsistencies_. **/
export class TestFrameworkConsistency {
	private readonly rule = new DiagnosticRule('python-test-framework-consistency');

	/** Responsibilities: _classification framework usage source_. **/
	private framework(source: LintSourceRecord): PythonTestFramework {
		const test_classes = source.normalized_ast.classes.filter(node =>
			node.methods.some(method => method.name.startsWith('test_') && !method.decorators.includes('fixture'))
		);
		if (test_classes.some(node => node.base_class_names.some(name => name === 'unittest.TestCase'))) {
			return 'unittest';
		}
		return 'pytest';
	}

	/** Responsibilities: _Python test files identification_. **/
	private is_test_file(source: LintSourceRecord): boolean {
		if (!source.python()) {
			return false;
		}
		if (!source.file_name.test_py()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _collection Python test files_. **/
	public test_files(context: LintProjectContext): TestFrameworkFile[] {
		const files: TestFrameworkFile[] = [];
		for (const source of context.files()) {
			if (this.is_test_file(source)) {
				files.push({ source, framework: this.framework(source) });
			}
		}
		return files;
	}

	/** Responsibilities: _test-framework consistency violations collection_. **/
	public violations(context: LintProjectContext): Violation[] {
		const files = this.test_files(context);
		if (files.length === 0) {
			return [];
		}
		const counts = new TestFrameworkCounts();
		for (const file of files) {
			counts.add(file.framework);
		}
		if (counts.all('unittest', files.length)) {
			return [];
		}
		return files
			.filter(file => file.framework !== 'unittest')
			.map(file => this.rule.violation(file.source.relative_path, 1, { framework: 'unittest' }));
	}
}
