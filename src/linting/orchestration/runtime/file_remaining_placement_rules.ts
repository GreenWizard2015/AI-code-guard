import ts from "typescript";

import type {
	FunctionPlacementRulesContract,
	ImportFanOutContract,
} from "src/linting/orchestration/runtime/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { PlacementFunctionNode } from "src/model/types/types";

/** Responsibilities: _file placement_, _import fan-out_. **/
export class FileRemainingPlacementRules {
	private readonly function_placement_rules: FunctionPlacementRulesContract;
	private readonly import_fan_out: ImportFanOutContract;

	/** Responsibilities: _placement rule dependencies initialization_. **/
	public constructor(
		import_fan_out: ImportFanOutContract,
		function_placement_rules: FunctionPlacementRulesContract,
	) {
		this.function_placement_rules = function_placement_rules;
		this.import_fan_out = import_fan_out;
	}

	/** Responsibilities: _import fan-out diagnostics_. **/
	public append_imports(
		violations: ViolationContract[],
		file: string,
		source: LintSourceRecord,
		source_file: ts.SourceFile,
	): void {
		if (source.python()) {
			this.import_fan_out.append_python(violations, file, source.normalized_ast);
			return;
		}
		this.import_fan_out.append_typescript(violations, file, source_file);
	}

	/** Responsibilities: _function placement diagnostics_. **/
	public append_function_placements(
		violations: ViolationContract[],
		file: string,
		functions: readonly PlacementFunctionNode[],
	): void {
		this.function_placement_rules.append_module(violations, file, functions);
		this.function_placement_rules.append_domain(violations, file, functions);
		this.function_placement_rules.append_cli(violations, file, functions);
	}
}
