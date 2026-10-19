import { basename, extname } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";
import type { PlacementFunctionNode } from "src/model/types/types";
import type { FunctionPlacementRulesContract } from "src/linting/orchestration/runtime/protocols";
import { FUNCTION_MODULE_NAMES } from "src/constants";

/** Responsibilities: _function module placement_, _domain class placement_, _CLI entry point count_. **/
export class FunctionPlacementRules implements FunctionPlacementRulesContract {
	private readonly domain_file_names: ReadonlySet<string>;

	/** Responsibilities: _domain filename policy initialization_. **/
	constructor() {
		this.domain_file_names = FUNCTION_MODULE_NAMES;
	}

	/** Responsibilities: _module function placement_. **/
	public append_module(
		violations: ViolationContract[],
		file: string,
		functions: readonly PlacementFunctionNode[],
	): void {
		const normalized_file = file.replaceAll("\\", "/");
		if (this.domain_file_names.has(normalized_file)) {
			return;
		}
		if (basename(normalized_file).startsWith("cli.")) {
			return;
		}
		const rule = new DiagnosticRule("function-placement");
		for (const node of functions) {
			if (node.nested === true) {
				continue;
			}
			violations.push(rule.violation(file, node.start + 1, { ext: extname(file).slice(1) }));
		}
	}

	/** Responsibilities: _domain class placement_. **/
	public append_domain(
		violations: ViolationContract[],
		file: string,
		functions: readonly PlacementFunctionNode[],
	): void {
		const normalized_file = file.replaceAll("\\", "/");
		if (normalized_file.includes("/")) {
			return;
		}
		if (!this.domain_file_names.has(normalized_file)) {
			return;
		}
		const rule = new DiagnosticRule("functions-file-domain-class");
		for (const node of functions) {
			if (node.nested === true) {
				continue;
			}
			violations.push(rule.violation(file, node.start + 1));
		}
	}

	/** Responsibilities: _CLI entry point count_. **/
	public append_cli(violations: ViolationContract[], file: string, functions: readonly PlacementFunctionNode[]): void {
		if (!basename(file.replaceAll("\\", "/")).startsWith("cli.")) {
			return;
		}
		const module_functions = functions.filter((node) => node.nested !== true);
		if (module_functions.length <= 1) {
			return;
		}
		const rule = new DiagnosticRule("cli-file-function-count");
		for (const node of module_functions.slice(1)) {
			violations.push(rule.violation(file, node.start + 1, { ext: extname(file).slice(1) }));
		}
	}
}
