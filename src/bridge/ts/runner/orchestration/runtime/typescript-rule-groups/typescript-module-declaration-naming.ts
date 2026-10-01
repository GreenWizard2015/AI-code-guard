import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";
import { UPPER_SNAKE_CASE_PATTERN } from "src/bridge/ts/rules/constants";
import type { NamedSymbol } from "src/types";

/** Responsibilities: _module declaration naming_, _module variable prohibition_. **/
export class TypeScriptModuleDeclarationNaming {
	private readonly constant_rule = new DiagnosticRule("typescript-module-constant-case");
	private readonly variable_rule = new DiagnosticRule("typescript-module-variable");

	/** Responsibilities: _module constant naming violation_. **/
	private append_constant_violation(violations: Violation[], file: string, symbol: NamedSymbol): void {
		if (UPPER_SNAKE_CASE_PATTERN.test(symbol.name) || symbol.name.startsWith("_")) {
			return;
		}
		violations.push(this.constant_rule.violation(file, symbol.line + 1, { name: symbol.name }));
	}

	/** Responsibilities: _module variable violation_. **/
	private append_variable_violation(violations: Violation[], file: string, symbol: NamedSymbol): void {
		if (symbol.kind !== "variable") {
			return;
		}
		violations.push(this.variable_rule.violation(file, symbol.line + 1, { name: symbol.name }));
	}

	/** Responsibilities: _module constant violations_. **/
	public append_constants(violations: Violation[], file: string, symbols: NamedSymbol[]): void {
		for (const symbol of symbols) {
			if (symbol.is_module_constant === true) {
				this.append_constant_violation(violations, file, symbol);
			}
		}
	}

	/** Responsibilities: _module variable violations_. **/
	public append_variables(violations: Violation[], file: string, symbols: NamedSymbol[]): void {
		for (const symbol of symbols) {
			if (symbol.is_module_variable === true) {
				this.append_variable_violation(violations, file, symbol);
			}
		}
	}
}
