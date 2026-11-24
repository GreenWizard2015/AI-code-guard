import { dirname, extname, resolve } from "node:path";
import type { WorkerUrlPathsContract } from "src/core/project-source/types";
import { WorkerModuleReferenceScan } from "src/core/project-source/worker_module_reference_scan";
import type { LintProjectContextContract } from "src/shared_services_protocols";

/** Responsibilities: _Worker reference discovery_, _project Worker reachability_. **/
export class ProjectSourceWorkerEntries {
	private readonly _context: LintProjectContextContract;
	private readonly _url_paths: WorkerUrlPathsContract;

	/** Responsibilities: _Worker URL extension candidates_. **/
	private extension_candidates(absolute_path: string): string[] {
		if (extname(absolute_path).length > 0) {
			return [absolute_path];
		}
		return [".ts", ".js", ".mts", ".mjs"].map((extension) => `${absolute_path}${extension}`);
	}

	/** Responsibilities: _available Worker entries_. **/
	private candidate_entries(file: string, paths: readonly string[]): string[] {
		const entries = new Set<string>();
		for (const path of paths) {
			if (path.length === 0) {
				continue;
			}
			const absolute_path = resolve(dirname(file), path);
			for (const candidate of this.extension_candidates(absolute_path)) {
				entries.add(candidate);
			}
		}
		return [...entries];
	}

	/** Responsibilities: _Worker entry initialization_. **/
	public constructor(context: LintProjectContextContract, url_paths: WorkerUrlPathsContract) {
		this._context = context;
		this._url_paths = url_paths;
	}

	/** Responsibilities: _Worker module discovery_. **/
	public entry_files_for(file: string): string[] {
		if (!/\.[cm]?tsx?$/u.test(file)) {
			return [];
		}
		const source_file = this._context.source_record(file).typescript_ast.source_file_node();
		const scan = new WorkerModuleReferenceScan(source_file, this._url_paths);
		if (!scan.worker_import_present()) {
			return [];
		}
		const references = scan.references();
		return this.candidate_entries(file, references.module_paths);
	}

	/** Responsibilities: _project Worker reachability_. **/
	public entry_files(files: readonly string[], available_files: ReadonlySet<string>): string[] {
		const entries = new Set<string>();
		for (const file of files) {
			for (const candidate of this.entry_files_for(file)) {
				if (available_files.has(candidate)) {
					entries.add(candidate);
				}
			}
		}
		return [...entries];
	}
}
