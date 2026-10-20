import { DiagnosticRule } from "src/model/diagnostic_rule";
import { MODULE_INTERFACE_KIND, MODULE_PROTOCOL_KIND, PROTOCOL_NAME_PREFIX } from "src/constants";
import { CONTRACT_SUFFIX } from "src/metrics/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstClassNode } from "src/types";

/** Responsibilities: _contract naming validation_, _forbidden protocol term diagnostics_. **/
export class ContractNames {
	private readonly suffix = CONTRACT_SUFFIX;
	private readonly forbidden_name_parts = [PROTOCOL_NAME_PREFIX, MODULE_PROTOCOL_KIND, MODULE_INTERFACE_KIND] as const;
	private readonly rule: DiagnosticRule;

	/** Responsibilities: _contract naming validation_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.rule = new DiagnosticRule("contract-naming");
	}
	/** Responsibilities: _public operation_. **/
	public contract(file: string, node: AstClassNode): boolean {
		if (file.endsWith(".py")) {
			return node.protocol === true;
		}
		return node.type_contract === true || node.protocol === true;
	}

	/** Responsibilities: _contract suffix validation_. **/
	public suffix_valid(file: string, node: AstClassNode): boolean {
		if (!this.contract(file, node)) {
			return true;
		}
		const normalized_name = node.name.toLowerCase();
		if (!node.name.endsWith(this.suffix)) {
			return false;
		}
		return !this.forbidden_name_parts.some((part) => normalized_name.includes(part));
	}

	/** Responsibilities: _contract naming diagnostics_. **/
	public append(violations: ViolationContract[], file: string, classes: readonly AstClassNode[]): void {
		for (const node of classes) {
			if (this.suffix_valid(file, node)) {
				continue;
			}
			violations.push(this.rule.violation(file, node.start + 1, {}));
		}
	}
}
