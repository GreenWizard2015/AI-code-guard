import type {
	CallableConcreteDescendantIndexContract,
	CallableSourceIdentityGraphContract,
	CallableSymbolIndexContract,
} from "src/analysis_protocols";
import type { StringReadonlySetMap, StringSetMap } from "src/analysis_types";
import type { CallableClassIndex } from "src/metrics/types";
import type { CallableOwnershipRequest } from "src/types";

export type CallableOwnershipMatchOptions = {
	readonly class_nodes: CallableClassIndex;
	readonly class_interfaces: readonly string[];
	readonly symbols: CallableSymbolIndexContract;
	readonly identities: CallableSourceIdentityGraphContract;
	readonly type_names_cache: StringSetMap;
	readonly type_members_cache: StringReadonlySetMap;
	readonly concrete_descendant_index: CallableConcreteDescendantIndexContract;
	readonly request: CallableOwnershipRequest;
};
