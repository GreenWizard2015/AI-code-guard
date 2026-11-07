import { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import { CallableReferenceMatcher } from "src/linting/orchestration/runtime/global-analysis/callable-usage/reference-matching/callable_reference_matcher";
import type { ParsedFile } from "src/metrics/types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { CallableReferenceScanMap } from "tests/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_reference_scan_map";

/** Responsibilities: _callable usage scenario_, _reference scan measurement_. **/
export class CallableReferenceMatcherScenario {
	private _unrelated_reference_accesses = 0;

	/** Responsibilities: _external callable usage lookup_. **/
	public files_using_target(normalized: NormalizedAstFile): Set<string> {
		const file: ParsedFile = {
			file: "worker.ts",
			absolute_file: "worker.ts",
			imports: new Set(),
			ast: normalized,
			reference_aliases: [],
		};
		const references = new CallableUsageReferences();
		references.append_file(file);
		const snapshot = references.snapshot(new Set());
		const source_references = snapshot.references_by_file.get(file.file);
		if (source_references === undefined) {
			return new Set();
		}
		const reference_scan = new CallableReferenceScanMap(source_references);
		const worker_class = normalized.source.classes.at(0);
		if (worker_class === undefined) {
			return new Set();
		}
		const target_method = worker_class.structure.methods.at(0);
		if (target_method === undefined) {
			return new Set();
		}
		reference_scan.measure();
		const matcher = new CallableReferenceMatcher({
			callable: {
				definition: { file: file.file, kind: "method", node: target_method },
				is_python: false,
			},
			source: {
				production_file_index: new Map([[file.file, file]]),
			},
			project: {
				definitions: [],
				project_types: new Map(),
				class_nodes: new Map(),
				matcher_indexes: {
					classes: new Map(),
					protocol_names: new Set(),
					methods_by_owner: new Map(),
					method_owner_counts: new Map(),
					files_by_name: new Map([[file.file, file]]),
					contract_method_files: snapshot.contract_method_files,
					method_owner_references: snapshot.method_owner_references,
				},
			},
			references: {
				reference_index: snapshot.reference_index,
				references_by_file: new Map([[file.file, reference_scan]]),
				ownership: () => false,
			},
		});
		const usage_files = matcher.external_files("definition.ts", 1, new Set([file.file]));
		this._unrelated_reference_accesses = reference_scan.unrelated_reference_visits();
		return usage_files;
	}

	/** Responsibilities: _reference scan accounting_. **/
	public unrelated_reference_visits(): number {
		return this._unrelated_reference_accesses;
	}
}
