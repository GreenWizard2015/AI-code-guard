import { relative } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { LintProjectContextContract, ProjectSourceScannerContract, ViolationContract } from "src/protocols";
import type { ProjectSourceAnalysisOptions } from "src/types";

/** Responsibilities: _production importer classification_, _test import diagnostics_. **/
export class ProductionTestImportAnalyzer {
	private readonly root: string;

	private readonly project_files: readonly string[];

	private readonly context: LintProjectContextContract;

	private readonly ignored_files: ReadonlySet<string>;

	private readonly scanner: ProjectSourceScannerContract;

	private readonly files: Set<string>;

	private readonly rule: DiagnosticRule;

	/** Responsibilities: _classification production importer_. **/
	private production_importer(file: string): boolean {
		if (this.ignored_files.has(file)) {
			return false;
		}
		return this.context.source_record(file).file_name.product();
	}

	/** Responsibilities: _classification test import target_. **/
	private test_target(file: string): boolean {
		if (!this.files.has(file)) {
			return false;
		}
		if (this.ignored_files.has(file)) {
			return false;
		}
		return this.context.source_record(file).file_name.test();
	}

	/** Responsibilities: _import analysis_. **/
	public constructor(options: ProjectSourceAnalysisOptions) {
		this.rule = new DiagnosticRule("production-test-import");
		this.root = options.root;
		this.project_files = options.project_files;
		this.context = options.context;
		this.ignored_files = options.ignored_files;
		this.files = options.files;
		this.scanner = options.scanner;
	}

	/** Responsibilities: _collection production-test import violations_. **/
	public test_targets(importer: string): string[] {
		if (!this.production_importer(importer)) {
			return [];
		}
		const targets: string[] = [];
		for (const target of this.scanner.resolved_imports(importer, this.files)) {
			if (this.test_target(target)) {
				targets.push(target);
			}
		}
		return targets;
	}

	/** Responsibilities: _collection production-test import violations_. **/
	public collect_violations(): ViolationContract[] {
		return this.project_files.flatMap((file) =>
			this.test_targets(file).map((target) =>
				this.rule.violation(relative(this.root, file), 1, {
					target: relative(this.root, target).split("\\").join("/"),
				}),
			),
		);
	}
}
