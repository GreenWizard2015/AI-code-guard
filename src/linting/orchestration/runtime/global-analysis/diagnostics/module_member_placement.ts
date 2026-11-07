import {
	MODULE_CLASS_KIND,
	MODULE_CONSTANT_KIND,
	MODULE_INTERFACE_KIND,
	MODULE_PROTOCOL_KIND,
	MODULE_TYPE_KIND,
	MODULE_VARIABLE_KIND,
} from "src/constants";
import { ModuleMemberDescription } from "src/linting/orchestration/runtime/global-analysis/diagnostics/module_member_description";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import type { LintProjectContextContract, PlacementAnalysisContract } from "src/shared_services_protocols";

/** Responsibilities: _module member classification_, _destination path resolution_. **/
export class ModuleMemberPlacement {
	private readonly _context: LintProjectContextContract;

	/** Responsibilities: _module member placement initialization_. **/
	public constructor(context: LintProjectContextContract) {
		this._context = context;
	}

	/** Responsibilities: _member destination index_. **/
	public destinations(placement: PlacementAnalysisContract): ReadonlyMap<string, string> {
		const kinds = [
			MODULE_CLASS_KIND,
			MODULE_INTERFACE_KIND,
			MODULE_PROTOCOL_KIND,
			MODULE_TYPE_KIND,
			MODULE_CONSTANT_KIND,
			MODULE_VARIABLE_KIND,
			MODULE_FUNCTION_KIND,
		];
		const locations = new Map<string, string>();
		for (const kind of kinds) {
			locations.set(kind, placement.member_location(kind));
		}
		return locations;
	}

	/** Responsibilities: _module member descriptions_. **/
	public descriptions(placement: PlacementAnalysisContract): string {
		const ast = this._context.source_record(placement.target()).normalized_ast;
		const locations = this.destinations(placement);
		const description = new ModuleMemberDescription(ast, locations);
		return description.description();
	}
}
