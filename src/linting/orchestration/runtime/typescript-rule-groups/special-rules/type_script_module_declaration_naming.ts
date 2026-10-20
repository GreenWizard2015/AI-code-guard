import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { UPPER_SNAKE_CASE_PATTERN } from "src/rules/constants";
import type { NamedSymbol } from "src/types";
import { MODULE_VARIABLE_KIND } from "src/constants";

/** Responsibilities: _module declaration naming_, _module variable prohibition_. **/
export class TypeScriptModuleDeclarationNaming {
	private readonly constant_rule: DiagnosticRule;
	private readonly variable_rule: DiagnosticRule;

	/** Responsibilities: _module constant naming violation_. **/
	private append_constant_violation(violations: ViolationContract[], file: string, symbol: NamedSymbol): void {
		if (UPPER_SNAKE_CASE_PATTERN.test(symbol.name) || symbol.name.startsWith("_")) {
			return;
		}
		violations.push(this.constant_rule.violation(file, symbol.line + 1, { name: symbol.name }));
	}

	/** Responsibilities: _module variable violation_. **/
	private append_variable_violation(violations: ViolationContract[], file: string, symbol: NamedSymbol): void {
		if (symbol.kind !== MODULE_VARIABLE_KIND) {
			return;
		}
		violations.push(this.variable_rule.violation(file, symbol.line + 1, { name: symbol.name }));
	}

	/** Responsibilities: _module constant rule initialization_. **/
	public constructor() {
		this.constant_rule = new DiagnosticRule("typescript-module-constant-case");
		this.variable_rule = new DiagnosticRule("typescript-module-variable");
	}

	/** Responsibilities: _module constant violations_. **/
	public append_constants(violations: ViolationContract[], file: string, symbols: NamedSymbol[]): void {
		for (const symbol of symbols) {
			if (symbol.is_module_constant === true) {
				this.append_constant_violation(violations, file, symbol);
			}
		}
	}

	/** Responsibilities: _module variable violations_. **/
	public append_variables(violations: ViolationContract[], file: string, symbols: NamedSymbol[]): void {
		for (const symbol of symbols) {
			if (symbol.is_module_variable === true) {
				this.append_variable_violation(violations, file, symbol);
			}
		}
	}
}
