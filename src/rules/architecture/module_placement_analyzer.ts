import { dirname, extname, relative } from "node:path";
import { CODING_LINT_PATH_PREFIX, SOURCE_EXTENSIONS } from "src/constants";
import { ModuleMemberPlacement } from "src/linting/orchestration/runtime/global-analysis/diagnostics/module_member_placement";
import { PlacementAnalysis } from "src/linting/orchestration/runtime/global-rules/placement_analysis";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { PlacementAnalysisContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";

/** Responsibilities: _module importer collection_, _placement violation analysis_. **/
export class ModulePlacementAnalyzer {
	private readonly _root: string;

	private readonly _project_files: readonly string[];

	private readonly _context: LintProjectContextContract;

	private readonly _scanner: ProjectSourceScanContract;

	private readonly _files: Set<string>;

	private readonly _ignored_files: ReadonlySet<string>;

	private readonly _member_placement: ModuleMemberPlacement;

	/** Responsibilities: _directory source inventory_. **/
	private directory_source_counts(files: ReadonlySet<string>): Map<string, number> {
		const counts = new Map<string, number>();
		for (const file of files) {
			if (!SOURCE_EXTENSIONS.has(extname(file))) {
				continue;
			}
			const directory = dirname(file);
			let count = counts.get(directory);
			if (count === undefined) {
				count = 0;
			}
			counts.set(directory, count + 1);
		}
		return counts;
	}

	/** Responsibilities: _placement candidate classification_. **/
	private candidate(placement: PlacementAnalysisContract): boolean {
		const target = placement.target();
		if (!this._files.has(target)) {
			return false;
		}
		if (!this._context.source_record(target).file_name.product()) {
			return false;
		}
		if (this._context.source_record(target).file_name.functions_file()) {
			return false;
		}
		if (this._ignored_files.has(target)) {
			return false;
		}
		if (relative(this._root, target).startsWith(CODING_LINT_PATH_PREFIX)) {
			return false;
		}
		return placement.valid();
	}

	/** Responsibilities: _import target indexing_. **/
	private append_imports(result: Map<string, string[]>, importer: string): void {
		for (const target of this._scanner.imports(importer, this._files).resolved_targets()) {
			let importers = result.get(target);
			if (importers === undefined) {
				importers = [];
			}
			importers.push(importer);
			result.set(target, importers);
		}
	}

	/** Responsibilities: _target placement violations_. **/
	private target_violations(
		target: string,
		importers: string[],
		directory_source_counts: ReadonlyMap<string, number>,
	): ViolationContract[] {
		const placement = new PlacementAnalysis(this._root, this._files, target, importers, directory_source_counts);
		if (!this.candidate(placement)) {
			return [];
		}
		const rule = new DiagnosticRule("module-placement");
		return [
			rule.violation(relative(this._root, target), 1, {
				...placement.parameters(this._member_placement.descriptions(placement)),
			}),
		];
	}

	/** Responsibilities: _analysis dependency initialization_. **/
	public constructor(options: ProjectSourceAnalysisOptions) {
		this._root = options.root;
		this._project_files = options.project_files;
		this._context = options.context;
		this._ignored_files = options.ignored_files;
		this._scanner = options.scanner;
		this._files = options.files;
		this._member_placement = new ModuleMemberPlacement(this._context);
	}

	/** Responsibilities: _importer map construction_. **/
	public collect_importers(): Map<string, string[]> {
		const result = new Map<string, string[]>();
		for (const importer of this._project_files) {
			if (this._ignored_files.has(importer)) {
				continue;
			}
			const importer_name = this._context.source_record(importer).file_name;
			if (!importer_name.product()) {
				continue;
			}
			if (importer_name.functions_file()) {
				continue;
			}
			this.append_imports(result, importer);
		}
		return result;
	}

	/** Responsibilities: _language-scoped placement diagnostics_. **/
	public collect_language_violations(
		importers_by_target: ReadonlyMap<string, string[]>,
		language: AstLanguage,
	): ViolationContract[] {
		const directory_source_counts = this.directory_source_counts(this._files);
		const violations: ViolationContract[] = [];
		for (const [target, importers] of importers_by_target) {
			if (!SOURCE_EXTENSIONS.has(extname(target))) {
				continue;
			}
			if (this._context.source_record(target).language !== language) {
				continue;
			}
			violations.push(...this.target_violations(target, importers, directory_source_counts));
		}
		return violations;
	}
}
