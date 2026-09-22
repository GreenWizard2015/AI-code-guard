import { DirectoryRules } from 'src/bridge/ts/rules/support/directory-rules';
import { PlacementSupport } from 'src/bridge/ts/runner/placement-support';
import { Reexports } from 'src/bridge/ts/runner/orchestration/runtime/python/reexports';
import ts from 'typescript';
import type { FunctionCount, LintSourceRecord } from 'src/types';
import type { Violation } from 'src/protocols';
import { CodingRuleLinter } from 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { SingletonCollector } from 'src/bridge/ts/runner/orchestration/runtime/singleton-collector';
import { FileFunctionCountReporter } from 'src/bridge/ts/runner/orchestration/runtime/file-function-count-reporter';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { TestPathSyntax } from 'src/test-path-syntax';
import { RULES_BY_ID } from 'src/model/constants';

/** Responsibilities: _collection file-level callable test_. **/
export class FileViolationCollector {
	private readonly placement_support = new PlacementSupport();
	private readonly reexports = new Reexports();
	private readonly function_count_reporter = new FileFunctionCountReporter();
	private readonly test_path_syntax = new TestPathSyntax();
	/** Responsibilities: _summary callable count first_. **/
	private function_count(functions: readonly { start: number }[]): FunctionCount {
		let first_line = 0;
		if (functions[0] !== undefined) {
			first_line = functions[0].start;
		}
		return { count: functions.length, first_line };
	}

	/** Responsibilities: _aggregation test-file location diagnostics_. **/
	private append_test_location(
		violations: Violation[],
		source: LintSourceRecord,
		file: string
	): void {
		if (!this.test_path_syntax.test_file(source.relative_path)) {
			return;
		}
		if (this.test_path_syntax.test_file(source.relative_path, true)) {
			return;
		}
		const rule = RULES_BY_ID.get('test-file-location');
		if (rule !== undefined) {
			violations.push(rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _collection singleton violations normalization_. **/
	private collect_singletons(
		source: LintSourceRecord,
		file: string,
		text: string,
		python: boolean
	): Violation[] {
		const local_class_names = new Set(source.normalized_ast.classes.map(node => node.name));
		let source_file: ts.SourceFile;
		if (source.typescript()) {
			source_file = source.typescript_ast.source_file;
		} else {
			source_file = ts.createSourceFile(file, '', ts.ScriptTarget.Latest, true);
		}
		const singleton_collector = new SingletonCollector(
			file,
			text,
			local_class_names,
			source.normalized_ast,
			source_file
		);
		return singleton_collector.collect_violations(python);
	}

	/** Responsibilities: _aggregation coding-rule violations source_. **/
	private append_coding_rules(
		violations: Violation[],
		source: LintSourceRecord,
		file: string,
		text: string
	): void {
		const source_ast = new SourceFileAst(
			{ file, text },
			source.normalized_ast,
			this.source_file(source, file, text),
		);
		const coding_rule_linter = new CodingRuleLinter(source_ast);
		violations.push(...coding_rule_linter.lint());
	}

	/** Responsibilities: _retrieval normalization source record_. **/
	private source_file(
		source: LintSourceRecord,
		file: string,
		text: string,
	): ts.SourceFile {
		if (source.typescript()) {
			return source.typescript_ast.source_file;
		}
		return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _aggregation remaining file-level violations_. **/
	public append_remaining_violations(
		violations: Violation[],
		source: LintSourceRecord,
		file: string,
		text: string,
		python: boolean
	): void {
		this.placement_support.append_function_violations(violations, file, source.normalized_ast.functions);
		this.reexports.append_reexport_violations(violations, file, text, source);
		this.function_count_reporter.append(
			violations,
			file,
			source.file_name,
			this.function_count(source.normalized_ast.functions)
		);
		this.append_coding_rules(violations, source, file, text);
		violations.push(...this.collect_singletons(source, file, text, python));
	}

	/** Responsibilities: _aggregation directory structure violations_. **/
	public append_directory(
		violations: Violation[],
		source: LintSourceRecord,
		file: string,
		text: string
	): void {
		this.append_test_location(violations, source, file);
		const directory_rules = new DirectoryRules();
		directory_rules.append_file_violation({
			violations,
			file,
			text,
			classes: source.normalized_ast.classes,
			docstring_spans: source.normalized_ast.docstring_spans,
			normalized_ast: source.normalized_ast,
		});
	}
}
