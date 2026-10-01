import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReportViolation } from "src/types";
import type { ShortReviewResult, TaskDocuments } from "tests/bridge/ts/core/types";
import { TestFixture } from "tests/core/test-fixture";

/** Responsibilities: _architecture review scenarios_. **/
export class TaskReviewScenario {
	/** Responsibilities: _construction report violation fixture_. **/
	private violation(
		file: string,
		line: number,
		rule_id: string,
		priority: ReportViolation["priority"],
	): ReportViolation {
		return {
			file,
			line,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority,
		};
	}

	/** Responsibilities: _code problem review_. **/
	public code_problem_result(): TaskDocuments {
		const fixture = new TestFixture();
		return fixture.with_temporary_files("task-code-problem-", { "a.ts": "const value = 1;\n" }, (root, reporting) => {
			const review = join(root, ".ai-code-guard", "review");
			mkdirSync(review, { recursive: true });
			writeFileSync(join(review, "unfinished.md"), "unfinished review\n");
			const output = reporting.format([this.violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "top-category",
				skip_review: false,
			});
			return {
				output,
				issues: readFileSync(join(root, ".ai-code-guard", "issues.md"), "utf8"),
				report: readFileSync(join(root, ".ai-code-guard", "report.md"), "utf8"),
			};
		});
	}

	/** Responsibilities: _empty lint report_. **/
	public clean_result(): TaskDocuments {
		const fixture = new TestFixture();
		return fixture.with_temporary_files("task-clean-", {}, (root, reporting) => ({
			output: reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false }),
			issues: "",
			report: readFileSync(join(root, ".ai-code-guard", "report.md"), "utf8"),
		}));
	}

	/** Responsibilities: _review status scenarios_. **/
	public review_statuses(): { pending: boolean; skipped: boolean; completed: boolean } {
		const fixture = new TestFixture();
		return fixture.with_temporary_files("task-review-status-", {}, (root, reporting) => {
			const pending = reporting.review_requested([], false);
			const skipped = reporting.review_requested([], true);
			const review = join(root, ".ai-code-guard", "review");
			mkdirSync(review, { recursive: true });
			const initial = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
			const completion_match = initial.match(
				/Primary agent private completion code \(do not delegate\): ([0-9a-f]{32})/u,
			);
			let completion_code = "";
			if (completion_match !== null) {
				completion_code = completion_match[1];
			}
			writeFileSync(join(review, "complete.md"), completion_code);
			return { pending, skipped, completed: reporting.review_requested([], false) };
		});
	}

	/** Responsibilities: _completed architecture review_. **/
	public completed_review(): string {
		const fixture = new TestFixture();
		return fixture.with_temporary_files("task-review-code-", {}, (root, reporting) => {
			const initial = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
			const completion_match = initial.match(
				/Primary agent private completion code \(do not delegate\): ([0-9a-f]{32})/u,
			);
			let completion_code = "";
			if (completion_match !== null) {
				completion_code = completion_match[1];
			}
			const review = join(root, ".ai-code-guard", "review");
			mkdirSync(review, { recursive: true });
			writeFileSync(join(review, "complete.md"), completion_code);
			return reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		});
	}

	/** Responsibilities: _short review_. **/
	public short_review_result(): ShortReviewResult {
		const fixture = new TestFixture();
		return fixture.with_temporary_files("task-review-", {}, (root, reporting) => {
			const review = join(root, ".ai-code-guard", "review");
			mkdirSync(review, { recursive: true });
			writeFileSync(join(review, "short.md"), "too short\n");
			writeFileSync(
				join(review, "problem.md"),
				`${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`,
			);
			return {
				output: reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false }),
				short_file_exists: existsSync(join(review, "short.md")),
			};
		});
	}
}
