import type {
	CallableConcreteDescendantIndexContract,
	CallableOwnershipMatchGraphContract,
	CallableSourceIdentityGraphContract,
	CallableSymbolIndexContract,
} from "src/analysis_protocols";
import type { StringReadonlySetMap, StringSetMap } from "src/analysis_types";
import { CallableConcreteDescendantIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_concrete_descendant_index";
import { CallableOwnershipMatch } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_ownership_match";
import { CallableSourceIdentityGraph } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_source_identity_graph";
import { CallableSymbolIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_symbol_index";
import type { CallableOwnershipMatchOptions } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/types";
import type { CallableClassIndex, CallableProjectIndex, ParsedFile } from "src/metrics/types";
import type { CallableOwnershipRequest } from "src/types";

/** Responsibilities: _callable graph indexes_, _callable ownership resolution_. **/
export class CallableOwnershipGraph implements CallableOwnershipMatchGraphContract {
	private readonly _class_nodes: CallableClassIndex;
	private readonly _symbols: CallableSymbolIndexContract;
	private readonly _identities: CallableSourceIdentityGraphContract;
	private readonly _type_names_cache: StringSetMap;
	private readonly _type_members_cache: StringReadonlySetMap;
	private readonly _concrete_descendant_index: CallableConcreteDescendantIndexContract;

	/** Responsibilities: _interface method type lookup_. **/
	/** Responsibilities: _request graph initialization_. **/
	public constructor(
		project_types: CallableProjectIndex,
		class_nodes: CallableClassIndex,
		parsed_files: readonly ParsedFile[] = [],
	) {
		this._type_names_cache = new Map<string, Set<string>>();
		this._type_members_cache = new Map<string, ReadonlySet<string>>();
		this._class_nodes = class_nodes;
		this._symbols = new CallableSymbolIndex(project_types);
		const identities = new CallableSourceIdentityGraph(class_nodes, project_types);
		identities.index_sources(parsed_files);
		this._identities = identities;
		this._concrete_descendant_index = new CallableConcreteDescendantIndex(identities.concrete_descendants(class_nodes));
	}

	/** Responsibilities: _callable ownership decision_. **/
	public match(request: CallableOwnershipRequest): boolean {
		const options: CallableOwnershipMatchOptions = {
			class_nodes: this._class_nodes,
			class_interfaces: request.class_node.structure.interfaces,
			symbols: this._symbols,
			identities: this._identities,
			type_names_cache: this._type_names_cache,
			type_members_cache: this._type_members_cache,
			concrete_descendant_index: this._concrete_descendant_index,
			request,
		};
		const ownership_match = new CallableOwnershipMatch(options);
		return ownership_match.match();
	}
}
