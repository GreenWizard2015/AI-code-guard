import type {
	CallableUsageDefinition,
	CallableUsageFile,
	CallableUsageIndexState,
	CallableUsageReferenceSnapshot,
	MatcherClassIndexes,
	MatcherIndexes,
	MethodOwnerIndexes,
} from "src/contracts/types/callable_usage_types";
import { CallableUsageDeclarations } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_declarations";
import { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import { MethodOwnerIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/method_owner_index";

/** Responsibilities: _declaration catalog_, _reference catalog_. **/
export class CallableUsageIndex {
	private readonly _declarations: CallableUsageDeclarations;
	private readonly _references: CallableUsageReferences;

	/** Responsibilities: _matcher index collection_, _owner method records_. **/
	private matcher_indexes(
		owner_indexes: MethodOwnerIndexes,
		class_indexes: MatcherClassIndexes,
		references: CallableUsageReferenceSnapshot,
	): MatcherIndexes {
		return {
			classes: class_indexes.classes,
			protocol_names: class_indexes.protocol_names,
			methods_by_owner: owner_indexes.methods_by_owner,
			method_owner_counts: owner_indexes.method_owner_counts,
			files_by_name: references.files_by_name,
			contract_method_files: references.contract_method_files,
			method_owner_references: references.method_owner_references,
		};
	}

	/** Responsibilities: _callable usage index initialization_. **/
	public constructor() {
		this._declarations = new CallableUsageDeclarations();
		this._references = new CallableUsageReferences();
	}

	/** Responsibilities: _callable index output_, _definition matcher data_. **/
	public state(definitions: readonly CallableUsageDefinition[]): CallableUsageIndexState {
		const project_types = this._declarations.type_index();
		const class_nodes = this._declarations.class_index();
		const class_indexes = this._declarations.matcher_classes();
		this._references.append_implementations(definitions);
		const reference_snapshot = this._references.snapshot(class_indexes.protocol_names);
		const owner_index = new MethodOwnerIndex();
		owner_index.append(definitions);
		const matcher_indexes = this.matcher_indexes(owner_index.indexes(), class_indexes, reference_snapshot);
		return {
			project_types,
			class_nodes,
			matcher_indexes,
			reference_index: reference_snapshot.reference_index,
			references_by_file: reference_snapshot.references_by_file,
		};
	}

	/** Responsibilities: _source references_, _production declarations_. **/
	public append_files(production_files: readonly CallableUsageFile[], test_files: readonly CallableUsageFile[]): void {
		for (const file of production_files) {
			this._references.append_file(file);
			this._declarations.append(file);
		}
		for (const file of test_files) {
			this._references.append_file(file);
		}
	}
}
