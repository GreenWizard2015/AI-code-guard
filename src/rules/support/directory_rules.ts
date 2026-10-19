import { DirectoryCommentSegments } from "src/core/support/source-analysis/directory_comment_segments";
import { AiCodeGuardIgnoreRule } from "src/rules/support/ai_code_guard_ignore_rule";
import { DirectoryFileRules } from "src/rules/support/directory_file_rules";
import { DirectoryStructureRules } from "src/rules/support/directory_structure_rules";
import { ModuleDeclarationsRule } from "src/rules/support/module_declarations_rule";
import { SingleClassFileNameRule } from "src/rules/support/single_class_file_name_rule";
import { MAX_FILE_LINES, MIN_FILE_LINES } from "src/constants";
import { PYTHON_PACKAGE_SUFFIX } from "src/constants";
import type {
	DirectoryRulesContract,
	ModuleDeclarationsRuleContract,
	SingleClassFileNameRuleContract,
	ViolationContract,
} from "src/protocols";
import type { ProjectSourceIOContract } from "src/protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import type { NormalizedAstFile } from "src/types";
import type { DirectoryFileSet } from "src/types";
import type { DirectoryFileViolationOptions } from "src/model/types/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _directory structure_, _directory diagnostics_. **/
export class DirectoryRules implements DirectoryRulesContract {
	private readonly directory_file_rules: DirectoryFileRules;
	private readonly directory_comment_segments: DirectoryCommentSegments;
	private readonly max_file_lines = MAX_FILE_LINES;
	private readonly min_file_lines = MIN_FILE_LINES;
	private readonly module_declarations_rule: ModuleDeclarationsRuleContract;
	private readonly file_name_rule: SingleClassFileNameRuleContract;
	private readonly ignore_rule: AiCodeGuardIgnoreRule;
	private readonly file_io: IOContract;
	/** Responsibilities: _maximum file-size violations addition_. **/
	private append_file_max(violations: ViolationContract[], file: string, text: string): void {
		if (this.module_declarations_rule.declaration_module(file)) {
			return;
		}
		const raw_line_count = text.split("\n").length;
		if (raw_line_count <= this.max_file_lines) {
			return;
		}
		violations.push(
			this.directory_file_rules.FILE_MAX_RULE.violation(file, 1, {
				count: String(raw_line_count),
			}),
		);
	}

	/** Responsibilities: _classification file exempt directory_. **/
	private should_skip_file(file: string, normalized_file: string): boolean {
		const test_path_syntax = new TestPathSyntax();

		if (this.directory_file_rules.entrypoint_wrapper(file)) {
			return true;
		}
		if (this.module_declarations_rule.declaration_module(file)) {
			return true;
		}
		if (normalized_file.endsWith(PYTHON_PACKAGE_SUFFIX)) {
			return true;
		}
		return test_path_syntax.test_file(file);
	}

	/** Responsibilities: _aggregation size violations directory_. **/
	private append_file_size(options: DirectoryFileViolationOptions): void {
		const { violations, file, text, classes, docstring_spans } = options;
		const line_count = this.directory_comment_segments.count_code_lines(text, file.endsWith(".py"), docstring_spans);
		if (this.directory_file_rules.protocol_info(violations, file, line_count, classes)) {
			return;
		}
		if (line_count >= this.min_file_lines) {
			return;
		}
		if (this.file_name_rule.focused_class_file(file, classes)) {
			return;
		}
		if (this.directory_file_rules.small_owner(classes)) {
			return;
		}
		violations.push(this.directory_file_rules.FILE_SIZE_RULE.violation(file, 1, {}));
	}

	/** Responsibilities: _aggregation configuration file-size diagnostics_. **/
	/** Responsibilities: _directory rule initialization_. **/
	public constructor(file_io: IOContract, source_io: ProjectSourceIOContract) {
		this.file_io = file_io;
		this.directory_file_rules = new DirectoryFileRules();
		this.directory_comment_segments = new DirectoryCommentSegments();
		this.file_name_rule = new SingleClassFileNameRule();
		this.module_declarations_rule = new ModuleDeclarationsRule();
		this.ignore_rule = new AiCodeGuardIgnoreRule(source_io);
	}

	/** Responsibilities: _directory file violation collection_. **/
	public append_file_violation(options: DirectoryFileViolationOptions): void {
		const { violations, file, text, normalized_ast } = options;
		const normalized_file = file.split("\\").join("/");
		this.append_file_max(violations, file, text);
		this.file_name_rule.append(violations, file, normalized_ast.classes);
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
		source_asts: ReadonlyMap<string, NormalizedAstFile>,
		directory_files: DirectoryFileSet,
	): ViolationContract[] {
		const directory_structure_rules = new DirectoryStructureRules(directory_files, this.file_io);

		const violations: ViolationContract[] = [];
		if (!directory_files.virtual_project) {
			this.ignore_rule.append(violations, repo_root);
		}
		directory_structure_rules.append_directory_violations(violations, files, repo_root, class_counts, source_asts);
		return violations;
	}
}
