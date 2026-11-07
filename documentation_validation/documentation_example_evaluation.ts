import { resolve } from "node:path";
import { ERROR_MARKER_PATTERN } from "documentation_validation/constants";
import { DocumentationExampleOutcome } from "documentation_validation/documentation_example_outcome";
import { DocumentationExamplePathLayout } from "documentation_validation/examples/documentation_example_path_layout";
import { DocumentationExamplePathValidation } from "documentation_validation/examples/documentation_example_path_validation";
import type { DocumentationExamplePathLayoutContract } from "documentation_validation/protocols";
import type {
	DocumentationExample,
	DocumentationExampleExecutorContract,
	DocumentationExampleLintContract,
	DocumentationExampleSourceFile,
	DocumentationExampleSourceFiles,
	ExampleResult,
} from "documentation_validation/types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _single example linting_, _single example result assembly_. **/
export class DocumentationExampleEvaluation {
	private readonly _example: DocumentationExample;
	private readonly _lint_runner: DocumentationExampleLintContract;
	private readonly _executor: DocumentationExampleExecutorContract;
	private readonly _layout: DocumentationExamplePathLayoutContract;
	private readonly _path_validation: DocumentationExamplePathValidation;

	/** Responsibilities: _example lint execution_. **/
	private lint(): readonly ViolationContract[] {
		const project_root = resolve(
			"/virtual/rule-documentation-example",
			this._example.rule_id,
			this._example.language,
			`${this._example.kind}-${this._example.index}`,
		);
		return this._lint_runner.lint(
			project_root,
			this._layout.analysis_path(),
			this._example.rule_id,
			this.source_files(),
		);
	}

	/** Responsibilities: _CLI example output validation_. **/
	private execution_issues(): string[] {
		const entry = this._example.source_files.find((file) => {
			const name = file.path.split("/").at(-1);
			return name === "cli.ts" || name === "cli.py";
		});
		if (entry === undefined) {
			return [];
		}
		const execution = this._executor.capture_output(this._example);
		if (execution.exit_code !== 0) {
			return [`${entry.path} exited with code ${execution.exit_code}`, execution.stdout];
		}
		if (execution.stdout.trim().length === 0) {
			return [`${entry.path} produced no output`];
		}
		return [];
	}

	/** Responsibilities: _example evaluation initialization_. **/
	public constructor(
		example: DocumentationExample,
		lint_runner: DocumentationExampleLintContract,
		executor: DocumentationExampleExecutorContract,
	) {
		this._example = example;
		this._lint_runner = lint_runner;
		this._executor = executor;
		this._layout = new DocumentationExamplePathLayout(example);
		this._path_validation = new DocumentationExamplePathValidation(example);
	}

	/** Responsibilities: _example source preparation_. **/
	public source_files(): DocumentationExampleSourceFiles {
		const files: DocumentationExampleSourceFile[] = [];
		for (const source_file of this._example.source_files) {
			const text = source_file.text.replace(ERROR_MARKER_PATTERN, (marker) => " ".repeat(marker.length));
			files.push({ path: source_file.path, text });
		}
		if (files.length === 0) {
			const text = this._example.text.replace(ERROR_MARKER_PATTERN, (marker) => " ".repeat(marker.length));
			files.push({ path: this._layout.analysis_path(), text });
		}
		return files;
	}

	/** Responsibilities: _language example validation_. **/
	public language_result(): ExampleResult {
		const structural_errors = [
			...this._path_validation.source_path_issues(this._layout.analysis_path()),
			...this._path_validation.cli_order_issues(),
		];
		if (structural_errors.length === 0) {
			structural_errors.push(...this.execution_issues());
		}
		let violations: readonly ViolationContract[] = [];
		if (structural_errors.length === 0) {
			violations = this.lint();
		}
		const outcome = new DocumentationExampleOutcome(this._example, violations, structural_errors);
		return {
			example: this._example,
			violations: outcome.violations(),
			structural_errors,
			passed: outcome.passes(),
		};
	}
}
