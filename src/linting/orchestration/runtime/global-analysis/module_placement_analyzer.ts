import { PlacementSupport } from "src/linting/orchestration/runtime/global-rules/placement_support";
import { ModuleMemberPlacement } from "src/linting/orchestration/runtime/global-analysis/module_member_placement";
import { relative } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import { CODING_LINT_PATH_PREFIX } from "src/constants";

/** Responsibilities: _module importer collection_, _placement violation analysis_. **/
export class ModulePlacementAnalyzer {
	private readonly root: string;

	private readonly project_files: readonly string[];

	private readonly context: LintProjectContextContract;

	private readonly scanner: ProjectSourceScannerContract;

	private readonly files: Set<string>;

	private readonly ignored_files: ReadonlySet<string>;

	private readonly member_placement: ModuleMemberPlacement;

	private readonly placement_support: PlacementSupport;

	/** Responsibilities: _construction target-to-importers map project_. **/
	private collect_importers(scanner: ProjectSourceScannerContract, files: Set<string>): Map<string, string[]> {
		const result = new Map<string, string[]>();
		for (const importer of this.project_files) {
			if (this.ignored_files.has(importer)) {
				continue;
			}
			const importer_name = this.context.source_record(importer).file_name;
			if (!importer_name.product()) {
				continue;
			}
			if (importer_name.is_functions_file) {
				continue;
			}
			this.append_imports(result, importer, scanner, files);
		}
		return result;
	}

	/** Responsibilities: _valid target classification_. **/
	private candidate(target: string, importers: string[]): boolean {
		if (!this.files.has(target)) {
			return false;
		}
		if (!this.context.source_record(target).file_name.product()) {
			return false;
		}
		if (this.context.source_record(target).file_name.is_functions_file) {
			return false;
		}
		if (this.ignored_files.has(target)) {
			return false;
		}
		if (relative(this.root, target).startsWith(CODING_LINT_PATH_PREFIX)) {
			return false;
		}
		return this.placement_support.placement_candidate(this.root, target, importers);
	}

	/** Responsibilities: _aggregation resolution imports importer_. **/
	private append_imports(
		result: Map<string, string[]>,
		importer: string,
		scanner: ProjectSourceScannerContract,
		files: Set<string>,
	): void {
		for (const target of scanner.resolved_imports(importer, files)) {
			let importers = result.get(target);
			if (importers === undefined) {
				importers = [];
			}
			importers.push(importer);
			result.set(target, importers);
		}
	}

	/** Responsibilities: _collection module-placement violations_. **/
	private collect_with(scanner: ProjectSourceScannerContract, files: Set<string>): ViolationContract[] {
		const importers_by_target = this.collect_importers(scanner, files);
		const result: ViolationContract[] = [];
		for (const [target, importers] of importers_by_target) {
			result.push(...this.collect_target(target, importers));
		}
		return result;
	}

	/** Responsibilities: _initialization project files context_. **/
	constructor(options: ProjectSourceAnalysisOptions) {
		this.root = options.root;
		this.project_files = options.project_files;
		this.context = options.context;
		this.ignored_files = options.ignored_files;
		this.scanner = options.scanner;
		this.files = options.files;
		this.placement_support = new PlacementSupport(this.files);
		this.member_placement = new ModuleMemberPlacement(this.root, this.context, this.placement_support);
	}

	/** Responsibilities: _collection placement violations imported_. **/
	public collect_target(target: string, importers: string[]): ViolationContract[] {
		if (!this.candidate(target, importers)) {
			return [];
		}
		const rule = new DiagnosticRule("module-placement");
		return [
			rule.violation(relative(this.root, target), 1, {
				...this.placement_support.placement_parameters(
					this.root,
					target,
					importers,
					this.member_placement.descriptions(target, importers),
				),
			}),
		];
	}

	/** Responsibilities: _collection placement violations_. **/
	public collect_violations(): ViolationContract[] {
		return this.collect_with(this.scanner, this.files);
	}
}
