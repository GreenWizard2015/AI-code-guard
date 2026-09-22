import { PlacementSupport } from 'src/bridge/ts/runner/placement-support';
import { relative } from 'node:path';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { LintProjectContext } from 'src/protocols';
import { ProjectSourceScanner } from 'src/bridge/ts/project-source-scanner';


/** Responsibilities: _collection importers evaluate placement_. **/
export class ModulePlacementAnalyzer {
	private readonly root: string;

	private readonly project_files: readonly string[];

	private readonly context: LintProjectContext;

	private readonly scanner: ProjectSourceScanner;

	private readonly files: Set<string>;

	private readonly ignored_files: ReadonlySet<string>;

	/** Responsibilities: _construction target-to-importers map project_. **/
	private collect_importers(): Map<string, string[]> {
		const result = new Map<string, string[]>();
		for (const importer of this.project_files) {
			if (this.ignored_files.has(importer)) {
				continue;
			}
			const importer_name = this.context.source_record(importer).file_name;
			if (!importer_name.product() || importer_name.is_functions_file) {
				continue;
			}
			this.append_imports(result, importer);
		}
		return result;
	}

	/** Responsibilities: _valid target classification_. **/
	private candidate(target: string, importers: string[]): boolean {
		const placement_support = new PlacementSupport();

		if (!this.context.source_record(target).file_name.product()) {
			return false;
		}
		if (this.ignored_files.has(target)) {
			return false;
		}
		if (relative(this.root, target).startsWith('tools/coding-lint/')) {
			return false;
		}
		return placement_support.placement_candidate(this.root, target, importers);
	}

	/** Responsibilities: _aggregation resolution imports importer_. **/
	private append_imports(result: Map<string, string[]>, importer: string): void {
		for (const target of this.scanner.resolved_imports(importer, this.files)) {
			let importers = result.get(target);
			if (importers === undefined) {
				importers = [];
			}
			importers.push(importer);
			result.set(target, importers);
		}
	}

	/** Responsibilities: _initialization project files context_. **/
	constructor(
		root: string,
		project_files: readonly string[],
		context: LintProjectContext,
		ignored_files: ReadonlySet<string>,
	) {
		this.root = root;
		this.project_files = project_files;
		this.context = context;
		this.scanner = new ProjectSourceScanner(root, {
			context_state: { available: true, value: context },
			entry_files: [],
		});
		this.files = new Set(project_files);
		this.ignored_files = ignored_files;
	}

	/** Responsibilities: _collection placement violations imported_. **/
	public collect_target(target: string, importers: string[]): Violation[] {
		const placement_support = new PlacementSupport();

		if (!this.candidate(target, importers)) {
			return [];
		}
		const rule = new DiagnosticRule('module-placement');
		return [rule.violation(relative(this.root, target), 1, {
			...placement_support.placement_parameters(this.root, target, importers),
		})];
	}

	/** Responsibilities: _collection module-placement violations imported_. **/
	public collect_violations(): Violation[] {
		const importers_by_target = this.collect_importers();
		const result: Violation[] = [];
		for (const [target, importers] of importers_by_target) {
			result.push(...this.collect_target(target, importers));
		}
		return result;
	}
}
