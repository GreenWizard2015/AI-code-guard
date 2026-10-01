import { DirectoryRules } from "src/bridge/ts/rules/support/directory-rules";
import type { LintSourceRecord } from "src/types";
import type { RemainingViolationOptions } from "src/bridge/ts/runner/orchestration/runtime/types";
import type { Violation } from "src/protocols";
import { TestPathSyntax } from "src/test-path-syntax";
import { RULES_BY_ID } from "src/model/constants";
import { TestFileOrganization } from "src/bridge/ts/runner/orchestration/runtime/test-targets/test-file-organization";
import { FileSystemTestPathChecker } from "src/bridge/ts/runner/orchestration/runtime/test-targets/test-path-checker";
import { TestTargets } from "src/bridge/ts/runner/orchestration/runtime/test-targets/test-targets";
import { FileRemainingViolationCollector } from "src/bridge/ts/runner/orchestration/runtime/file-remaining-violation-collector";

/** Responsibilities: _collection file-level callable test_. **/
export class FileViolationCollector {
	private readonly test_path_syntax = new TestPathSyntax();
	private readonly remaining = new FileRemainingViolationCollector();

	/** Responsibilities: _aggregation test organization diagnostics_. **/
	private append_test_organization(
		violations: Violation[],
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
		const checker = new FileSystemTestPathChecker(project_root);
		const organization = new TestFileOrganization(project_root, checker);
		if (organization.valid(source.relative_path)) {
			return;
		}
		const rule = RULES_BY_ID.get("test-file-organization");
		if (rule !== undefined) {
			violations.push(rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _aggregation test target diagnostics_. **/
	private append_test_targets(
		violations: Violation[],
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
		const targets = new TestTargets(
			new TestFileOrganization(project_root, new FileSystemTestPathChecker(project_root)),
		);
		if (targets.valid(source.relative_path, source.text, source.python())) {
			return;
		}
		const rule = RULES_BY_ID.get("test-targets");
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
	private append_test_location(violations: Violation[], source: LintSourceRecord, file: string): void {
		if (!this.test_path_syntax.test_file(source.relative_path)) {
			return;
		}
		if (this.test_path_syntax.test_file(source.relative_path, true)) {
			return;
		}
		const rule = RULES_BY_ID.get("test-file-location");
		if (rule !== undefined) {
			violations.push(rule.violation(file, 1, {}));
		}
	}

	/** Responsibilities: _aggregation remaining file-level violations_. **/
	public append_remaining_violations(options: RemainingViolationOptions): void {
		this.remaining.append(options);
		this.remaining.append_language(options);
	}

	/** Responsibilities: _aggregation directory structure violations_. **/
	public append_directory(
		violations: Violation[],
		source: LintSourceRecord,
		file: string,
		text: string,
		project_root: string,
	): void {
		this.append_test_location(violations, source, file);
		this.append_test_organization(violations, source, file, project_root);
		this.append_test_targets(violations, source, file, project_root);
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
