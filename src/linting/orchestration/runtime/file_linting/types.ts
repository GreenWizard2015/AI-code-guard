import type {
	FileRemainingTextRulesContract,
	FunctionPlacementRulesContract,
	ImportFanOutContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { RemainingViolationOptions } from "src/model_types";
import type { CodingRuleLinterContract } from "src/shared_services_protocols";

/** Responsibilities: _remaining violation dependencies_. **/
export type FileRemainingViolationDependencies = {
	import_fan_out: ImportFanOutContract;
	function_placement_rules: FunctionPlacementRulesContract;
	text_rules: FileRemainingTextRulesContract;
	coding_rule_linter: CodingRuleLinterContract;
};

/** Responsibilities: _remaining violation execution context_. **/
export type FileRemainingViolationContext = {
	options: RemainingViolationOptions;
	dependencies: FileRemainingViolationDependencies;
	entry_point: boolean;
};
