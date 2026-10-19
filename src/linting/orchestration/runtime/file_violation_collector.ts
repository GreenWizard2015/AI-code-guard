import { DirectoryRules } from "src/rules/support/directory_rules";
import type { LintSourceRecord } from "src/types";
import type { RemainingViolationOptions } from "src/model/types/types";
import type {
	CodingRuleLinterContract,
	FileViolationCollectorContract,
	TestFileOrganizationContract,
	TestTargetsContract,
	ViolationContract,
} from "src/protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { RULES_BY_ID } from "src/model/constants";
import { RULE_IDS } from "src/constants";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";
import { FileSystemTestPathChecker } from "src/linting/orchestration/runtime/test-targets/file_system_test_path_checker";
import { TestTargets } from "src/linting/orchestration/runtime/test-targets/test_targets";
import { FileRemainingViolationCollector } from "src/linting/orchestration/runtime/file_remaining_violation_collector";
import type { TestTargetImportResolverContract } from "src/protocols";
import type { ProjectSourceIOContract } from "src/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _test layout validation_, _test target usage validation_. **/
export class FileViolationCollector implements FileViolationCollectorContract {
	private readonly test_path_syntax: TestPathSyntax;
	private readonly remaining: FileRemainingViolationCollector;
	private readonly import_resolver: TestTargetImportResolverContract;
	private readonly source_paths: readonly string[];
	private readonly file_io: IOContract;
	private readonly source_io: ProjectSourceIOContract;
	private readonly test_organizations: Map<string, TestFileOrganizationContract>;
	private readonly test_target_resolvers: Map<string, TestTargetsContract>;

	/** Responsibilities: _cached test file organization_. **/
	private test_organization(project_root: string): TestFileOrganizationContract {
		const cached = this.test_organizations.get(project_root);
		if (cached !== undefined) {
			return cached;
		}
		const checker = new FileSystemTestPathChecker(project_root, this.source_paths);
		const organization = new TestFileOrganization(project_root, checker);
		this.test_organizations.set(project_root, organization);
		return organization;
	}

	/** Responsibilities: _test target validator creation_. **/
	private test_targets(project_root: string): TestTargetsContract {
		const cached = this.test_target_resolvers.get(project_root);
		if (cached !== undefined) {
			return cached;
		}
		const targets = new TestTargets(project_root, this.test_organization(project_root), this.import_resolver);
		this.test_target_resolvers.set(project_root, targets);
		return targets;
	}

	/** Responsibilities: _test-target validation_. **/
	private valid_test_targets(targets: TestTargetsContract, source: LintSourceRecord): boolean {
		if (source.python()) {
			return targets.valid(source.relative_path, source.text, true, source.normalized_ast.python_imports);
		}
		return targets.valid_typescript(source.relative_path, source.typescript_ast.source_file_node());
	}

	/** Responsibilities: _aggregation test organization diagnostics_. **/
	private append_test_organization(
		violations: ViolationContract[],
		source: LintSourceRecord,
		file: string,
		project_root: string,
	): void {
		const normalized_path = source.relative_path.split("\\").join("/");
		if (!this.valid_test_filename(normalized_path)) {
			return;
		}
		if (!this.test_path_syntax.test_file(source.relative_path, true)) {
			return;
		}
		const organization = this.test_organization(project_root);
		if (organization.valid(source.relative_path)) {
			return;
		}
		const rule = RULES_BY_ID.get(RULE_IDS.test_file_organization);
		if (rule !== undefined) {
			violations.push(rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _aggregation test target diagnostics_. **/
	private append_test_targets(
		violations: ViolationContract[],
		source: LintSourceRecord,
		file: string,
		project_root: string,
	): void {
		const normalized_path = source.relative_path.split("\\").join("/");
		if (!this.valid_test_filename(normalized_path)) {
			return;
		}
		if (!this.test_path_syntax.test_file(source.relative_path, true)) {
			return;
		}
		const targets = this.test_targets(project_root);
		if (this.valid_test_targets(targets, source)) {
			return;
		}
		const rule = RULES_BY_ID.get(RULE_IDS.test_targets);
		if (rule !== undefined) {
			violations.push(rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _test filename eligibility_. **/
	private valid_test_filename(normalized_path: string): boolean {
		if (!normalized_path.startsWith("tests/")) {
			return true;
		}
		return this.test_path_syntax.test_file_name(normalized_path);
	}

	/** Responsibilities: _aggregation test-file location diagnostics_. **/
	private append_test_location(violations: ViolationContract[], source: LintSourceRecord, file: string): void {
		if (!this.test_path_syntax.test_file(source.relative_path)) {
			return;
		}
		if (this.test_path_syntax.test_file(source.relative_path, true)) {
			return;
		}
		const rule = RULES_BY_ID.get(RULE_IDS.test_file_location);
		if (rule !== undefined) {
			violations.push(rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _aggregation remaining file-level violations_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(
		import_resolver: TestTargetImportResolverContract,
		source_paths: readonly string[],
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
	) {
		this.test_path_syntax = new TestPathSyntax();
		this.remaining = new FileRemainingViolationCollector();
		this.import_resolver = import_resolver;
		this.source_paths = source_paths;
		this.file_io = file_io;
		this.source_io = source_io;
		this.test_organizations = new Map();
		this.test_target_resolvers = new Map();
	}
	/** Responsibilities: _public operation_. **/
	public append_remaining_violations(
		options: RemainingViolationOptions,
		coding_rule_linter: CodingRuleLinterContract,
	): void {
		this.remaining.append(options, coding_rule_linter);
		this.remaining.append_language(options);
	}

	/** Responsibilities: _aggregation directory structure violations_. **/
	public append_directory(
		violations: ViolationContract[],
		source: LintSourceRecord,
		file: string,
		text: string,
		project_root: string,
	): void {
		this.append_test_location(violations, source, file);
		this.append_test_organization(violations, source, file, project_root);
		this.append_test_targets(violations, source, file, project_root);
		const directory_rules = new DirectoryRules(this.file_io, this.source_io);
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
