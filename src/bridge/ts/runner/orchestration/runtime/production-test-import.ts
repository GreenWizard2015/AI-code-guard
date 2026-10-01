import { relative } from "node:path";
import { ProjectSourceScanner } from "src/bridge/ts/project-source-scanner";
import { DiagnosticRule } from "src/model/diagnostic-rule";
import type { LintProjectContext, Violation } from "src/protocols";

/** Responsibilities: _collection production-to-test import violations_. **/
export class ProductionTestImportAnalyzer {
	private readonly root: string;

	private readonly project_files: readonly string[];

	private readonly context: LintProjectContext;

	private readonly ignored_files: ReadonlySet<string>;

	private readonly scanner: ProjectSourceScanner;

	private readonly files: Set<string>;

	private readonly rule = new DiagnosticRule("production-test-import");

	/** Responsibilities: _classification production importer_. **/
	private production_importer(file: string): boolean {
		if (this.ignored_files.has(file)) {
			return false;
		}
		return this.context.source_record(file).file_name.product();
	}

	/** Responsibilities: _classification test import target_. **/
	private test_target(file: string): boolean {
		if (this.ignored_files.has(file)) {
			return false;
		}
		return this.context.source_record(file).file_name.test();
	}

	/** Responsibilities: _collection importer violations_. **/
	private importer_violations(importer: string): Violation[] {
		return this.test_targets(importer).map((target) =>
			this.rule.violation(relative(this.root, importer), 1, {
				target: relative(this.root, target).split("\\").join("/"),
			}),
		);
	}

	/** Responsibilities: _import analysis_. **/
	public constructor(
		root: string,
		project_files: readonly string[],
		context: LintProjectContext,
		ignored_files: ReadonlySet<string>,
	) {
		this.root = root;
		this.project_files = project_files;
		this.context = context;
		this.ignored_files = ignored_files;
		this.files = new Set(project_files);
		this.scanner = new ProjectSourceScanner(root, {
			context_state: { available: true, value: context },
			entry_files: [],
		});
	}

	/** Responsibilities: _collection imported test targets_. **/
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

	/** Responsibilities: _collection project production-to-test violations_. **/
	public collect_violations(): Violation[] {
		return this.project_files.flatMap((file) => this.importer_violations(file));
	}
}
