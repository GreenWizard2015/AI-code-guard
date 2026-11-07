import { relative } from "node:path";
import { PYTHON_SOURCE_EXTENSION, TEST_PATH_SUFFIXES } from "src/constants";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { UnusedSourceOptions } from "src/model_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { UnusedCodeContract } from "src/source_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _unresolved import detection_, _unused file analysis_. **/
export class UnusedCode implements UnusedCodeContract {
	private readonly _missing_import_rule: RuleContract;
	private readonly _unused_file_rule: RuleContract;

	/** Responsibilities: _missing import diagnostics_. **/
	private unresolved_import_violations(
		root: string,
		scanner: ProjectSourceScanContract,
		files: string[],
	): ViolationContract[] {
		const available = new Set(files);
		return files.flatMap((importer) => {
			const file = relative(root, importer).split("\\").join("/");
			const specifiers = scanner.imports(importer, available).unresolved_specifiers();
			return specifiers.map((specifier) => this._missing_import_rule.violation(file, 0, { specifier }));
		});
	}

	/** Responsibilities: _diagnostic policy_. **/
	public constructor() {
		this._missing_import_rule = new DiagnosticRule("missing-import");
		this._unused_file_rule = new DiagnosticRule("unused-file");
	}
	/** Responsibilities: _public operation_. **/
	public collect_scanner_violations(
		root: string,
		scanner: ProjectSourceScanContract,
		files: string[],
	): ViolationContract[] {
		const unresolved = this.unresolved_import_violations(root, scanner, files);
		const syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const reachable = scanner.reachable_files(files);
		const source_entry = scanner.project_source_entry();
		const unused = files.flatMap((file) => {
			const path = source_entry.relative_path(file);
			if (syntax.classify(path).has(TestPathKind.TestFile) || reachable.has(file)) {
				return [];
			}
			return [this._unused_file_rule.violation(path, 0, {})];
		});
		return [...unresolved, ...unused];
	}

	/** Responsibilities: _reporting unused scanning projection_. **/
	public collect_unused_files(options: UnusedSourceOptions): ViolationContract[] {
		const { root, source } = options;
		const scanner = new ProjectSourceScanner(root, source);
		const files = scanner.files();
		return this.collect_scanner_violations(root, scanner, files);
	}

	/** Responsibilities: _Python global unused-file diagnostics_. **/
	public unused_python_violations(options: UnusedSourceOptions): ViolationContract[] {
		const { root, source } = options;
		const scanner = new ProjectSourceScanner(root, source);
		const files = scanner.files().filter((file) => file.endsWith(PYTHON_SOURCE_EXTENSION));
		return this.collect_scanner_violations(root, scanner, files);
	}
}
