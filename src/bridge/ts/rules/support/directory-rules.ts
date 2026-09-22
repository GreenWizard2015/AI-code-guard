import { DirectoryCommentSegments } from 'src/bridge/ts/core/support/directory-comment-segments';
import { DirectoryFileRules } from 'src/bridge/ts/rules/support/directory-file-rules';
import { DirectoryStructureRules } from 'src/bridge/ts/rules/support/directory-structure-rules';
import { TestPathSyntax } from 'src/test-path-syntax';
import type { Violation } from 'src/protocols';
import { MAX_FILE_LINES, MIN_FILE_LINES } from 'src/constants';
import type { NormalizedAstFile } from 'src/types';
import { ModuleDeclarationsRule } from 'src/bridge/ts/rules/support/module-constants';
import type { DirectoryFileViolationOptions } from 'src/bridge/ts/rules/types';

/** Responsibilities: _directory file-size minimum-content enforcement_. **/
export class DirectoryRules {
	private readonly directory_file_rules = new DirectoryFileRules();
	private readonly directory_comment_segments = new DirectoryCommentSegments();
	private readonly max_file_lines = MAX_FILE_LINES;
	private readonly min_file_lines = MIN_FILE_LINES;
	private readonly module_declarations_rule = new ModuleDeclarationsRule();
	/** Responsibilities: _maximum file-size violations addition_. **/
	private append_file_max(violations: Violation[], file: string, text: string): void {
		if (this.module_declarations_rule.special_file(file)) {
			return;
		}
		const raw_line_count = text.split('\n').length;
		if (raw_line_count <= this.max_file_lines) {
			return;
		}
		violations.push(
			this.directory_file_rules.FILE_MAX_RULE.violation(file, 1, {
				count: String(raw_line_count),
			})
		);
	}

	/** Responsibilities: _classification file exempt directory_. **/
	private should_skip_file(file: string, normalized_file: string): boolean {
		const test_path_syntax = new TestPathSyntax();

		if (this.directory_file_rules.entrypoint_wrapper(file)) {
			return true;
		}
		if (this.module_declarations_rule.special_file(file)) {
			return true;
		}
		if (normalized_file.endsWith('/__init__.py')) {
			return true;
		}
		return test_path_syntax.test_file(file);
	}

	/** Responsibilities: _aggregation size violations directory_. **/
	private append_file_size(options: DirectoryFileViolationOptions): void {
		const { violations, file, text, classes, docstring_spans } = options;
		const line_count = this.directory_comment_segments.count_code_lines(
			text,
			file.endsWith('.py'),
			docstring_spans
		);
		if (this.directory_file_rules.protocol_info(violations, file, line_count, classes)) {
			return;
		}
if (line_count >= this.min_file_lines || this.directory_file_rules.small_owner(classes)) {
			return;
		}
		violations.push(this.directory_file_rules.FILE_SIZE_RULE.violation(file, 1));
	}

	/** Responsibilities: _aggregation configuration file-size diagnostics_. **/
	public append_file_violation(options: DirectoryFileViolationOptions): void {
		const { violations, file, text, normalized_ast } = options;
		const normalized_file = file.split('\\').join('/');
		this.append_file_max(violations, file, text);
		this.module_declarations_rule.append(violations, file, normalized_ast);
		if (this.should_skip_file(file, normalized_file)) {
			return;
		}
		this.append_file_size(options);
	}

	/** Responsibilities: _collection directory-level file-size violations_. **/
	public collect_directory_violations(
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, number>,
		source_asts: ReadonlyMap<string, NormalizedAstFile>
	): Violation[] {
		const directory_structure_rules = new DirectoryStructureRules();

		const violations: Violation[] = [];
		directory_structure_rules.append_directory_violations(
			violations,
			files,
			repo_root,
			class_counts,
			source_asts
		);
		return violations;
	}
}
