import { basename } from "node:path";
import { MAX_FILE_LINES, MIN_FILE_LINES } from "src/constants";
import { DirectoryCommentSegments } from "src/core/support/source-analysis/directory_comment_segments";
import type { IOContract } from "src/io/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DirectoryFileViolationOptions } from "src/model/types/types";
import type { DirectoryFileSet } from "src/project_analysis_types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import { AiCodeGuardIgnoreRule } from "src/rules/support/ai_code_guard_ignore_rule";
import { DirectoryStructureRules } from "src/rules/support/directory_structure_rules";
import { ModuleDeclarationsRule } from "src/rules/support/module_declarations_rule";
import { SingleClassFileNameRule } from "src/rules/support/single_class_file_name_rule";
import type {
	DirectoryRulesContract,
	ModuleDeclarationsRuleContract,
	SingleClassFileNameRuleContract,
} from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { AstClassNodeContract, NormalizedAstFileContract } from "src/types";

/** Responsibilities: _directory structure_, _directory diagnostics_. **/
export class DirectoryRules implements DirectoryRulesContract {
	private readonly file_size_rule: RuleContract;
	private readonly file_max_rule: RuleContract;
	private readonly directory_comment_segments: DirectoryCommentSegments;
	private readonly max_file_lines = MAX_FILE_LINES;
	private readonly min_file_lines = MIN_FILE_LINES;
	private readonly module_declarations_rule: ModuleDeclarationsRuleContract;
	private readonly file_name_rule: SingleClassFileNameRuleContract;
	private readonly ignore_rule: AiCodeGuardIgnoreRule;
	private readonly file_io: IOContract;

	/** Responsibilities: _maximum file-size violations addition_. **/
	private append_file_max(violations: ViolationContract[], file: string, text: string): void {
		const raw_line_count = text.split("\n").length;
		if (raw_line_count <= this.max_file_lines) {
			return;
		}
		violations.push(
			this.file_max_rule.violation(file, 1, {
				count: String(raw_line_count),
			}),
		);
	}

	/** Responsibilities: _aggregation size violations directory_. **/
	private append_file_size(options: DirectoryFileViolationOptions): void {
		const { violations, file, text, docstring_spans } = options;
		if (basename(file) === "conftest.py") {
			return;
		}
		const line_count = this.directory_comment_segments.count_code_lines(text, file.endsWith(".py"), docstring_spans);
		if (line_count >= this.min_file_lines) {
			return;
		}
		violations.push(this.file_size_rule.violation(file, 1, {}));
	}

	/** Responsibilities: _aggregation configuration file-size diagnostics_. **/
	/** Responsibilities: _directory rule initialization_. **/
	public constructor(file_io: IOContract, source_io: ProjectSourceIOContract) {
		this.file_io = file_io;
		this.file_size_rule = new DiagnosticRule("file-min-size");
		this.file_max_rule = new DiagnosticRule("file-max-size");
		this.directory_comment_segments = new DirectoryCommentSegments();
		this.file_name_rule = new SingleClassFileNameRule();
		this.module_declarations_rule = new ModuleDeclarationsRule();
		this.ignore_rule = new AiCodeGuardIgnoreRule(source_io);
	}

	/** Responsibilities: _directory file violation collection_. **/
	public append_file_violation(options: DirectoryFileViolationOptions): void {
		const { violations, file, text, normalized_ast } = options;
		this.append_file_max(violations, file, text);
		this.file_name_rule.append(violations, file, normalized_ast.classes);
		this.module_declarations_rule.append(violations, file, normalized_ast);
		this.append_file_size(options);
	}

	/** Responsibilities: _collection directory-level file-size violations_. **/
	public collect_directory_violations(
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, readonly AstClassNodeContract[]>,
		source_asts: ReadonlyMap<string, NormalizedAstFileContract>,
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
