import { relative } from "node:path";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";

/** Responsibilities: _production importer classification_, _test import diagnostics_. **/
export class ProductionTestImportAnalyzer {
	private readonly _root: string;

	private readonly _project_files: readonly string[];

	private readonly _context: LintProjectContextContract;

	private readonly _ignored_files: ReadonlySet<string>;

	private readonly _scanner: ProjectSourceScanContract;

	private readonly _files: Set<string>;

	private readonly _rule: RuleContract;

	/** Responsibilities: _test import violations_. **/
	private violations_for_file(file: string): ViolationContract[] {
		return this.test_targets(file).map((target) =>
			this._rule.violation(relative(this._root, file), 1, {
				target: relative(this._root, target).split("\\").join("/"),
			}),
		);
	}
	/** Responsibilities: _production test analysis setup_. **/
	public constructor(options: ProjectSourceAnalysisOptions) {
		this._rule = new DiagnosticRule("production-test-import");
		this._root = options.root;
		this._project_files = options.project_files;
		this._context = options.context;
		this._ignored_files = options.ignored_files;
		this._files = options.files;
		this._scanner = options.scanner;
	}

	/** Responsibilities: _production test targets_. **/
	public test_targets(importer: string): string[] {
		if (this._ignored_files.has(importer) || !this._context.source_record(importer).file_name.product()) {
			return [];
		}
		const targets: string[] = [];
		for (const target of this._scanner.imports(importer, this._files).resolved_targets()) {
			if (!this._files.has(target) || this._ignored_files.has(target)) {
				continue;
			}
			if (this._context.source_record(target).file_name.test()) {
				targets.push(target);
			}
		}
		return targets;
	}
	/** Responsibilities: _language import findings_. **/
	public language_violations(language: AstLanguage): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const file of this._project_files) {
			if (this._context.source_record(file).language !== language) {
				continue;
			}
			violations.push(...this.violations_for_file(file));
		}
		return violations;
	}
}
