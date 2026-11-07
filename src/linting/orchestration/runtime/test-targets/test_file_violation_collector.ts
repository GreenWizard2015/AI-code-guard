import { TEST_PATH_SUFFIXES } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { FileSystemTestPathChecker } from "src/linting/orchestration/runtime/test-targets/file_system_test_path_checker";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";
import { TestTargets } from "src/linting/orchestration/runtime/test-targets/test_targets";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import type {
	TestFileViolationCollectorContract,
	TestTargetImportResolverContract,
	TestTargetProject,
} from "src/testing_protocols";
import { TestPathKind } from "src/types";

/** Responsibilities: _test file placement_, _test targets_. **/
export class TestFileViolationCollector implements TestFileViolationCollectorContract {
	private readonly _path_syntax: TestPathSyntaxContract;
	private readonly _import_resolver: TestTargetImportResolverContract;
	private readonly _source_paths: readonly string[];
	private readonly _projects: Map<string, TestTargetProject>;
	private readonly _organization_rule: RuleContract;
	private readonly _target_rule: RuleContract;
	private readonly _location_rule: RuleContract;

	/** Responsibilities: _project test context lookup_. **/
	private test_project(root: string): TestTargetProject {
		const cached = this._projects.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const checker = new FileSystemTestPathChecker(root, this._source_paths);
		const organization = new TestFileOrganization(root, checker);
		const targets = new TestTargets(root, organization, this._import_resolver);
		const project = { organization, targets };
		this._projects.set(root, project);
		return project;
	}

	/** Responsibilities: _test filename validity_. **/
	private valid_test_filename(path: string): boolean {
		if (!path.startsWith("tests/")) {
			return true;
		}
		return this._path_syntax.classify(path).has(TestPathKind.TestFileName);
	}

	/** Responsibilities: _test file rule state_. **/
	public constructor(import_resolver: TestTargetImportResolverContract, source_paths: readonly string[]) {
		this._path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._import_resolver = import_resolver;
		this._source_paths = source_paths;
		this._projects = new Map();
		this._organization_rule = new DiagnosticRule(RULE_IDS.test_file_organization);
		this._target_rule = new DiagnosticRule(RULE_IDS.test_targets);
		this._location_rule = new DiagnosticRule(RULE_IDS.test_file_location);
	}

	/** Responsibilities: _test organization_, _test target_. **/
	public append(violations: ViolationContract[], source: LintSourceRecordData, file: string, root: string): void {
		if (!this.valid_test_filename(source.relative_path)) {
			return;
		}
		if (!this._path_syntax.classify(source.relative_path).has(TestPathKind.RootTestsFile)) {
			return;
		}
		const project = this.test_project(root);
		if (!project.organization.for_file(source.relative_path).valid()) {
			violations.push(this._organization_rule.violation(file, 1, {}));
		}
		if (!project.targets.valid_source(source)) {
			violations.push(this._target_rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _misplaced test file violation_. **/
	public append_location(violations: ViolationContract[], source: LintSourceRecordData, file: string): void {
		if (!this._path_syntax.classify(source.relative_path).has(TestPathKind.TestFile)) {
			return;
		}
		if (this._path_syntax.classify(source.relative_path).has(TestPathKind.RootTestsFile)) {
			return;
		}
		violations.push(this._location_rule.violation(file, 1, {}));
	}
}
