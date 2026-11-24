import { extname } from "node:path";
import type { FunctionPlacementRulesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	FunctionPlacementRuleName,
	ModulePlacementContext,
	PlacementFunctionNode,
} from "src/rules/architecture/types";

/** Responsibilities: _free function placement_, _domain class placement_, _entry point function count_. **/
export class FunctionPlacementRules implements FunctionPlacementRulesContract {
	private readonly _domain_file_names: ReadonlySet<string>;

	/** Responsibilities: _module function violations_. **/
	private append_reportable_functions(
		context: ModulePlacementContext,
		functions: readonly PlacementFunctionNode[],
	): void {
		const { violations, file, entry_point } = context;
		let rule_name: FunctionPlacementRuleName = "free-function-outside-entry-point";
		if (entry_point) {
			rule_name = "entry-point-function-count";
		}
		const rule = new DiagnosticRule(rule_name);
		for (const node of functions) {
			violations.push(rule.violation(file, node.identity.start + 1, { ext: extname(file).slice(1) }));
		}
	}

	/** Responsibilities: _module function placement_. **/
	private append_module_findings(context: ModulePlacementContext): void {
		const { file } = context;
		const normalized_file = file.replaceAll("\\", "/");
		if (this._domain_file_names.has(normalized_file)) {
			return;
		}
		let report_functions = context.functions.filter((node) => !node.identity.nested);
		if (context.entry_point && report_functions.length > 0) {
			report_functions = report_functions.slice(1);
		}
		if (report_functions.length > 0) {
			this.append_reportable_functions(context, report_functions);
		}
	}

	/** Responsibilities: _domain filename policy initialization_. **/
	public constructor(domain_file_names: ReadonlySet<string>) {
		this._domain_file_names = domain_file_names;
	}

	/** Responsibilities: _file free function diagnostics_. **/
	public append(
		violations: ViolationContract[],
		file: string,
		functions: readonly PlacementFunctionNode[],
		entry_point: boolean,
	): void {
		this.append_module_findings({ violations, file, functions, entry_point });
		const normalized_file = file.replaceAll("\\", "/");
		if (normalized_file.includes("/") || !this._domain_file_names.has(normalized_file)) {
			return;
		}
		const rule_name: FunctionPlacementRuleName = "functions-file-domain-class";
		const rule = new DiagnosticRule(rule_name);
		for (const node of functions) {
			if (node.identity.nested) {
				continue;
			}
			violations.push(rule.violation(file, node.identity.start + 1));
		}
	}
}
