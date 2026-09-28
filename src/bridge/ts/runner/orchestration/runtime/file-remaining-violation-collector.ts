import ts from 'typescript';
import type { FunctionCount, LintSourceRecord } from 'src/types';
import type { Violation } from 'src/protocols';
import type { RemainingViolationOptions } from 'src/bridge/ts/runner/orchestration/runtime/types';
import { PlacementSupport } from 'src/bridge/ts/runner/placement-support';
import { Reexports } from 'src/bridge/ts/runner/orchestration/runtime/python/reexports';
import { FileFunctionCountReporter } from 'src/bridge/ts/runner/orchestration/runtime/file-function-count-reporter';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { CodingRuleLinter } from 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { SingletonCollector } from 'src/bridge/ts/runner/orchestration/runtime/singleton-collector';
import { CyrillicTextRules } from 'src/bridge/ts/rules/support/cyrillic-text-rules';
import { TypeScriptCallableBody } from 'src/typescript-callable-aliases/typescript-callable-body';

/** Responsibilities: _collection remaining file-level violations_. **/
export class FileRemainingViolationCollector {
	private readonly placement_support = new PlacementSupport();
	private readonly reexports = new Reexports();
	private readonly function_count_reporter = new FileFunctionCountReporter();
	private readonly cyrillic_text_rules = new CyrillicTextRules();
	private readonly callable_body = new TypeScriptCallableBody();

	/** Responsibilities: _summary callable count first_. **/
	private function_count(functions: readonly { start: number }[]): FunctionCount {
		let first_line = 0;
		if (functions[0] !== undefined) {
			first_line = functions[0].start;
		}
		return { count: functions.length, first_line };
	}

	/** Responsibilities: _TypeScript callable count_. **/
	private typescript_function_count(source: LintSourceRecord): FunctionCount {
		let count = 0;
		let first_line = 0;
		const visit = (node: ts.Node): void => {
			if (this.callable_body.implemented(node)) {
				if (count === 0) {
					first_line = source.typescript_ast.source_file_node().getLineAndCharacterOfPosition(node.getStart()).line;
				}
				count += 1;
			}
			ts.forEachChild(node, visit);
		};
		visit(source.typescript_ast.source_file_node());
		return { count, first_line };
	}

	/** Responsibilities: _source function count selection_. **/
	private source_function_count(source: LintSourceRecord): FunctionCount {
		if (source.python()) {
			if (source.file_name.is_functions_file) {
				const python_count = source.normalized_ast.python_callable_count;
				if (python_count !== undefined) {
					return python_count;
				}
			}
		}
		if (!source.typescript()) {
			return this.function_count(source.normalized_ast.functions);
		}
		if (!source.file_name.is_functions_file) {
			return this.function_count(source.normalized_ast.functions);
		}
		return this.typescript_function_count(source);
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
			source_file = source.typescript_ast.source_file_node();
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

	/** Responsibilities: _retrieval normalization source record_. **/
	private source_file(source: LintSourceRecord, file: string, text: string): ts.SourceFile {
		if (source.typescript()) {
			return source.typescript_ast.source_file_node();
		}
		return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _aggregation coding-rule violations source_. **/
	private append_coding_rules(options: RemainingViolationOptions): void {
		const source_ast = new SourceFileAst(
			{ file: options.file, text: options.text },
			options.source.normalized_ast,
			this.source_file(options.source, options.file, options.text),
		);
		const coding_rule_linter = new CodingRuleLinter(source_ast, options.stage_timer);
		options.violations.push(...coding_rule_linter.lint());
	}

	/** Responsibilities: _common remaining violation stages_. **/
	private append_common(options: RemainingViolationOptions): void {
		const language = options.python ? 'python' : 'typescript';
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.placement`,
			() => this.placement_support.append_function_violations(
				options.violations, options.file, options.source.normalized_ast.functions
			)
		);
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.reexports`,
			() => this.reexports.append_reexport_violations(
				options.violations, options.file, options.text, options.source
			)
		);
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.coding-rules`,
			() => this.append_coding_rules(options)
		);
	}

	/** Responsibilities: _metric remaining violation stages_. **/
	private append_metrics(options: RemainingViolationOptions): void {
		const language = options.python ? 'python' : 'typescript';
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.function-count`,
			() => this.function_count_reporter.append(
				options.violations,
				options.file,
				options.source.file_name,
				this.source_function_count(options.source)
			)
		);
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.type-declarations`,
			() => this.function_count_reporter.append_type_declarations(
				options.violations,
				options.file,
				options.source.file_name,
				options.source.normalized_ast.type_declarations
			)
		);
	}

	/** Responsibilities: _remaining common analysis_. **/
	public append(options: RemainingViolationOptions): void {
		this.append_common(options);
		this.append_metrics(options);
	}

	/** Responsibilities: _remaining language analysis_. **/
	public append_language(options: RemainingViolationOptions): void {
		const language = options.python ? 'python' : 'typescript';
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.cyrillic`,
			() => options.violations.push(...this.cyrillic_text_rules.source_violations(
				options.file, options.text, options.python
			))
		);
		options.stage_timer.measure(
			`file-analysis.${language}.post-remaining.singletons`,
			() => options.violations.push(...this.collect_singletons(
				options.source, options.file, options.text, options.python
			))
		);
	}
}
