import type {
	CallableReferencesByFileContract,
	CallableUsageDefinition,
	CallableUsageFile,
	CallableUsageReferenceOccurrence,
	CallableUsageReferenceSnapshot,
} from "src/contracts/types/callable_usage_types";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import { CallableFileReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_file_references";
import { MethodFileIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/method_file_index";
import { OwnerReferenceIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/owner_reference_index";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";

/** Responsibilities: _source usage records_, _implementation entries_. **/
export class CallableUsageReferences {
	private readonly _files_by_name: Map<string, CallableUsageFile>;
	private readonly _reference_index: SourceReferenceIndexContract<string>;
	private readonly _references_by_file: CallableReferencesByFileContract;
	private readonly _method_owners: OwnerReferenceIndex;
	private readonly _protocol_files: MethodFileIndex;

	/** Responsibilities: _source usage indexing_. **/
	private append_source_usage(source_occurrence: CallableUsageReferenceOccurrence, seen_keys: Set<string>): void {
		const { file_name, reference } = source_occurrence;
		const index_key = `${reference.kind}:${reference.target_file}:${reference.name}`;
		if (!seen_keys.has(index_key)) {
			seen_keys.add(index_key);
			this._reference_index.add_usage(index_key, { file: file_name, line: reference.line });
		}
	}

	/** Responsibilities: _reference index initialization_. **/
	public constructor() {
		this._files_by_name = new Map<string, CallableUsageFile>();
		this._reference_index = new SourceReferenceIndex<string>();
		this._references_by_file = new Map();
		this._method_owners = new OwnerReferenceIndex();
		this._protocol_files = new MethodFileIndex();
	}

	/** Responsibilities: _file reference groups_. **/
	public append_file(file: CallableUsageFile): void {
		const references_by_name = new CallableFileReferences();
		const seen_keys = new Set<string>();
		for (const reference of file.ast.references.call_references) {
			const occurrence = { file_name: file.file, reference };
			references_by_name.append(reference);
			this.append_source_usage(occurrence, seen_keys);
		}
		references_by_name.finish();
		this._files_by_name.set(file.file, file);
		this._references_by_file.set(file.file, references_by_name);
		this._method_owners.replace_file(file);
		this._protocol_files.clear();
	}

	/** Responsibilities: _implementation locations_. **/
	public append_implementations(definitions: readonly CallableUsageDefinition[]): void {
		for (const definition of definitions) {
			this._reference_index.add_implementation(
				`${definition.kind}:${definition.file}:${definition.node.identity.name}`,
				{
					file: definition.file,
					line: definition.node.identity.start + 1,
				},
			);
		}
	}

	/** Responsibilities: _callable reference index snapshot_. **/
	public snapshot(contract_owner_names: ReadonlySet<string>): CallableUsageReferenceSnapshot {
		const method_owner_references = this._method_owners.references();
		return {
			reference_index: this._reference_index,
			references_by_file: this._references_by_file,
			files_by_name: this._files_by_name,
			method_owner_references,
			contract_method_files: this._protocol_files.candidates({
				method_references: method_owner_references,
				protocol_names: contract_owner_names,
				files_by_name: this._files_by_name,
			}),
		};
	}
}
