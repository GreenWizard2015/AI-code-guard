import { basename, extname } from "node:path";
import type { FunctionPlacementRulesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { PlacementFunctionNode } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _function module placement_, _domain class placement_, _CLI entry point count_. **/
export class FunctionPlacementRules implements FunctionPlacementRulesContract {
	private readonly _domain_file_names: ReadonlySet<string>;

	/** Responsibilities: _module function placement_. **/
	private append_module(
		module_violations: ViolationContract[],
		module_file: string,
		module_functions: readonly PlacementFunctionNode[],
	): void {
		const normalized_file = module_file.replaceAll("\\", "/");
		if (this._domain_file_names.has(normalized_file)) {
			return;
		}
		if (basename(normalized_file).startsWith("cli.")) {
			return;
		}
		const rule = new DiagnosticRule("function-placement");
		for (const node of module_functions) {
			if (node.identity.nested) {
				continue;
			}
			module_violations.push(
				rule.violation(module_file, node.identity.start + 1, { ext: extname(module_file).slice(1) }),
			);
		}
	}

	/** Responsibilities: _domain class placement_. **/
	private append_domain(
		functions_file_violations: ViolationContract[],
		functions_file: string,
		free_functions: readonly PlacementFunctionNode[],
	): void {
		const normalized_file = functions_file.replaceAll("\\", "/");
		if (normalized_file.includes("/")) {
			return;
		}
		if (!this._domain_file_names.has(normalized_file)) {
			return;
		}
		const rule = new DiagnosticRule("functions-file-domain-class");
		for (const node of free_functions) {
			if (node.identity.nested) {
				continue;
			}
			functions_file_violations.push(rule.violation(functions_file, node.identity.start + 1));
		}
	}

	/** Responsibilities: _CLI entry point count_. **/
	private append_cli(
		cli_violations: ViolationContract[],
		cli_file: string,
		entry_points: readonly PlacementFunctionNode[],
	): void {
		if (!basename(cli_file.replaceAll("\\", "/")).startsWith("cli.")) {
			return;
		}
		const entry_point_functions = entry_points.filter((node) => !node.identity.nested);
		if (entry_point_functions.length <= 1) {
			return;
		}
		const rule = new DiagnosticRule("cli-file-function-count");
		for (const node of entry_point_functions.slice(1)) {
			cli_violations.push(rule.violation(cli_file, node.identity.start + 1, { ext: extname(cli_file).slice(1) }));
		}
	}

	/** Responsibilities: _domain filename policy initialization_. **/
	public constructor(domain_file_names: ReadonlySet<string>) {
		this._domain_file_names = domain_file_names;
	}

	/** Responsibilities: _file function-placement diagnostics_. **/
	public append(violations: ViolationContract[], file: string, functions: readonly PlacementFunctionNode[]): void {
		this.append_module(violations, file, functions);
		this.append_domain(violations, file, functions);
		this.append_cli(violations, file, functions);
	}
}
