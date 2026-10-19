import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";
import type { NamedLine, NamedSymbol } from "src/types";

/** Responsibilities: _leading underscore validation_, _leading underscore diagnostics_. **/
export class LeadingUnderscoreNaming {
	private readonly diagnostic_rule: DiagnosticRule;
	/** Responsibilities: _leading underscore allowance classification_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.diagnostic_rule = new DiagnosticRule("naming-private");
	}
	/** Responsibilities: _public operation_. **/
	public allowed(symbol: NamedSymbol): boolean {
		return this.allowed_name(symbol.name, symbol.kind, symbol.visibility);
	}

	/** Responsibilities: _classification declaration name allowance_. **/
	public allowed_name(name: string, kind: string, visibility: string): boolean {
		if (!name.startsWith("_")) {
			return true;
		}
		if (/^_+$/u.test(name)) {
			return true;
		}
		if (kind === "field") {
			return true;
		}
		if (kind === "method") {
			if (/^__.*__$/u.test(name)) {
				return true;
			}
			return visibility === "private";
		}
		return false;
	}

	/** Responsibilities: _declaration leading underscore diagnostics_. **/
	public violation_for(file: string, line: number, label: string, name: string): ViolationContract {
		return this.diagnostic_rule.violation(file, line + 1, { label, name });
	}

	/** Responsibilities: _declaration leading underscore reporting_. **/
	public append_declaration_violation(violations: ViolationContract[], file: string, declaration: NamedLine): boolean {
		if (this.allowed_name(declaration.name, "type", "public")) {
			return false;
		}
		violations.push(this.violation_for(file, declaration.line, "type", declaration.name));
		return true;
	}
}
