import { ClassReporting } from 'src/bridge/ts/core/support/class-reporting';
import { TaskReporting } from 'src/bridge/ts/core/support/task-reporting';
import { LintRunConfiguration } from 'src/bridge/ts/core/lint-run-factory';
import type { LintRunResult } from 'src/bridge/ts/runtime/types';
import { mkdirSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { ClassStructureReporter } from 'src/metrics/class-structure-reporter';
import type { Violation } from 'src/protocols';
import { LintFileName } from 'src/bridge/ts/core/context/file-name';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import type { AstCallableNode, AstClassNode, AstTypeKind, AstVisibility } from 'src/types';
import { CodingRuleLinter } from 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import { LintProjectContextCreator } from 'src/bridge/ts/core/context-factory';
import { FixtureLists } from 'tests/core/fixture-lists';



import type { Fixture, TemporaryFilesCallback, FixtureCallableNode, FixtureClassNode } from 'tests/core/types';

/** Responsibilities: _construction test fixtures execution_. **/
export class TestFixture {
	private readonly lint_fixture_prefix = 'webmcp-coding-lint-';
	private readonly placement_fixture_prefix = 'module-placement-';

	/** Responsibilities: _fixture text values normalization_. **/
	private text_value<T>(value: T): string {
		if (typeof value === 'string') {
			return value;
		}
		return '';
	}

	/** Responsibilities: _fixture number values normalization_. **/
	private number_value<T>(value: T, fallback: number): number {
		if (typeof value === 'number') {
			return value;
		}
		return fallback;
	}

	/** Responsibilities: _fixture boolean values normalization_. **/
	private flag_value<T>(value: T): boolean {
		return value === true;
	}

	/** Responsibilities: _construction AST callable fixture_. **/
	private callable_node(node: FixtureCallableNode): AstCallableNode {
		const lists = new FixtureLists(node);
		return {
			name: this.text_value(node.name),
			owner: this.text_value(node.owner),
			start: this.number_value(node.start, 0),
			end: this.number_value(node.end, 0),
			argument_count: this.number_value(node.argument_count, 0),
			lines: this.number_value(node.lines, (this.number_value(node.end, 0) - this.number_value(node.start, 0)) + 1),
			sloc: this.number_value(node.sloc, (this.number_value(node.end, 0) - this.number_value(node.start, 0)) + 1),
			characters: this.number_value(node.characters, 0),
			statements: lists.statements,
			parameter_types: lists.parameter_types,
			untyped_parameters: lists.untyped_parameters,
			return_type: this.text_value(node.return_type),
			argument_uses: lists.argument_uses,
			typed_arguments: lists.typed_arguments,
			decorators: lists.decorators,
			is_accessor: this.flag_value(node.is_accessor),
			exception_only: this.flag_value(node.exception_only),
			has_self: this.flag_value(node.has_self),
			has_unittest_assertion: this.flag_value(node.has_unittest_assertion),
			unittest_exception_only: this.flag_value(node.unittest_exception_only),
			test_exception_bypass: this.flag_value(node.test_exception_bypass),
			unittest_ending_valid: this.flag_value(node.unittest_ending_valid),
			unittest_assertion_count: this.number_value(node.unittest_assertion_count, 0),
			visibility: this.visibility_value(node.visibility),
		};
	}

	/** Responsibilities: _construction AST class fixture_. **/
	private class_node(node: FixtureClassNode): AstClassNode {
		const lists = new FixtureLists({});
		lists.constructor_lists(node);
		return {
			name: this.text_value(node.name),
			start: this.number_value(node.start, 0),
			end: this.number_value(node.end, 0),
			methods: lists.methods.map(method => this.callable_node(method)),
			lines: this.number_value(node.lines, (this.number_value(node.end, 0) - this.number_value(node.start, 0)) + 1),
			sloc: this.number_value(node.sloc, (this.number_value(node.end, 0) - this.number_value(node.start, 0)) + 1),
			interfaces: lists.interfaces,
			base_class_name: this.text_value(node.base_class_name),
			base_class_names: lists.base_class_names,
			extends_external_class: this.flag_value(node.extends_external_class),
			is_data_class: this.flag_value(node.is_data_class),
			type_contract: this.flag_value(node.type_contract),
			protocol: this.flag_value(node.protocol),
			callback_fields: this.number_value(node.callback_fields, 0),
			inline_callback_fields: this.number_value(node.inline_callback_fields, 0),
			fields: lists.fields.map(field => ({
				line: this.number_value(field.line, 0),
				name: this.text_value(field.name),
				value_name: this.text_value(field.value_name),
				type: this.text_value(field.type),
				 type_kind: this.type_kind_value(field.type_kind),
			})),
			untyped_fields: [],
			dependencies: lists.dependencies,
		};
	}

	/** Responsibilities: _fixture visibility values normalization_. **/
	private visibility_value<T>(value: T): AstVisibility {
		if (value === 'private' || value === 'protected') {
			if (value === 'private') {
				return 'private';
			}
			return 'protected';
		}
		return 'public';
	}

	/** Responsibilities: _fixture type kinds normalization_. **/
	private type_kind_value<T>(value: T): AstTypeKind {
				const logical_condition_1 = value === 'named' || value === 'generic' || value === 'template';
if (logical_condition_1) {
			if (value === 'named') {
				return 'named';
			}
			if (value === 'generic') {
				return 'generic';
			}
			return 'template';
		}
		return 'basic';
	}

	/** Responsibilities: _output fixture files temporary_. **/
	private write_fixture_files(temp_dir: string, files: Record<string, string>): string[] {
		return Object.entries(files).map(([name, content]) => {
			const path = join(temp_dir, name);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, content);
			return path;
		});
	}

	/** Responsibilities: _lint file selection restoration_. **/
	private restore_lint_files(original: string = ''): void {
		if (original.length === 0) {
			delete process.env.CODING_LINT_FILES;
			return;
		}
		process.env.CODING_LINT_FILES = original;
	}

	/** Responsibilities: _execution callback temporary fixture_. **/
	public with_temporary_files<T>(
		prefix: string,
		files: Record<string, string>,
		callback: TemporaryFilesCallback<T>,
	): T {
		const root = mkdtempSync(join(tmpdir(), prefix));
		this.write_fixture_files(root, files);
		const reporting = new TaskReporting(root);
		try {
			return callback(root, reporting);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}

	/** Responsibilities: _execution lint collection fixture_. **/
	public collect_fixture_report(files: Record<string, string>, ...selected_lists: string[][]): LintRunResult {
		const lint_run_factory = new LintRunConfiguration();
		let selected_files: string[] = [];
		if (selected_lists[0] !== undefined) {
			selected_files = selected_lists[0];
		}

		const temp_dir = mkdtempSync(join(tmpdir(), this.lint_fixture_prefix));
		let original = '';
		if (process.env.CODING_LINT_FILES !== undefined) {
			original = process.env.CODING_LINT_FILES;
		}
		const paths = this.write_fixture_files(temp_dir, files);
		const selected_paths = selected_files.map(file => join(temp_dir, file));
		let files_to_lint = paths;
		if (selected_files.length > 0) {
			files_to_lint = selected_paths;
		}
		process.env.CODING_LINT_FILES = files_to_lint.join(',');
		try {
			const repo_root = process.cwd();
			const execution = lint_run_factory.lint_report(repo_root, [], new LintStageTimer());
			return execution.report;
		} finally {
			lint_run_factory.python_ast_worker.close();
			this.restore_lint_files(original);
			rmSync(temp_dir, { recursive: true, force: true });
		}
	}

	/** Responsibilities: _fixture violations collection_. **/
	public collect_fixture_violations(files: Record<string, string>, ...selected_lists: string[][]): Violation[] {
		return this.collect_fixture_report(files, ...selected_lists).violations;
	}

	/** Responsibilities: _fixture violation messages collection_. **/
	public violation_messages(files: Record<string, string>): string[] {
		const violations = this.collect_fixture_violations(files);
		const messages = violations.map(violation => violation.message);
		return [...messages];
	}

	/** Responsibilities: _class fixture violations addition_. **/
	public append_class_violations(violations: Violation[], file: string, node: FixtureClassNode): void {
		const class_reporting = new ClassReporting();
		const normalized_node = this.class_node(node);

		class_reporting.report_class_methods(violations, new LintFileName(file), normalized_node);
		const structure = new ClassStructureReporter(violations, new LintFileName(file), normalized_node);
		structure.report_design();
		structure.report_sizes();
	}

	/** Responsibilities: _module-placement fixture files creation_. **/
	public fixture(files: Record<string, string>): Fixture {
		const root = mkdtempSync(join(tmpdir(), this.placement_fixture_prefix));
		const paths = Object.keys(files).map(file => join(root, file));
		for (const [file, text] of Object.entries(files)) {
			const path = join(root, file);
			mkdirSync(join(path, '..'), { recursive: true });
			writeFileSync(path, text);
		}
		return { root, paths };
	}

	/** Responsibilities: _shared-parameter violations selection_. **/
	public shared_violations(violations: readonly Violation[]): Violation[] {
		const shared = violations.filter(violation => violation.message.includes('share parameter'));
		if (shared.length === 0) {
			return [];
		}
		return [...shared];
	}

	/** Responsibilities: _repeated AST lint comparison_. **/
	public shared_ast_lint_results(context_factory: LintProjectContextCreator): Violation[][] {
		return this.with_temporary_files('webmcp-lint-equivalence-', {
			'tools/coding-lint/rules.ts': 'const value = Object.assign({}, source);\n',
		}, root => {
			const file = join(root, 'tools/coding-lint/rules.ts');
			const source = context_factory.lint_context(root, [file], new LintStageTimer()).source_record(file);
			const ast_file = new TypeScriptAstFile(source.relative_path, source.text);
			const source_ast = new SourceFileAst({ file: source.relative_path, text: source.text }, ast_file.normalized(), ast_file.source_file);
			const source_linter = new CodingRuleLinter(source_ast);
			const shared_linter = new CodingRuleLinter(source_ast);
			return [source_linter.lint(), shared_linter.lint()];
		});
	}
}
