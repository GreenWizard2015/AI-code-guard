import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";
import type { NamedLine, NamedSymbol } from "src/types";

/** Responsibilities: _leading underscore validation_, _leading underscore diagnostics_. **/
export class LeadingUnderscoreNaming {
	private readonly diagnostic_rule = new DiagnosticRule("naming-private");
	/** Responsibilities: _leading underscore allowance classification_. **/
	public allowed(symbol: NamedSymbol): boolean {
		return this.allowed_name(symbol.name, symbol.kind, symbol.visibility);
	}

	/** Responsibilities: _classification declaration name allowance_. **/
	public allowed_name(name: string, kind: string, visibility: string): boolean {
		if (!name.startsWith("_")) {
			return true;
		}
		if (/^_+$/u.test(name) || kind === "field") {
			return true;
		}
		if (kind === "method" && /^__.*__$/u.test(name)) {
			return true;
		}
		return kind === "method" && visibility === "private";
	}

	/** Responsibilities: _leading underscore diagnostic creation_. **/
	public violation(file: string, symbol: NamedSymbol): Violation {
		let label: string = symbol.kind;
		if (symbol.kind === "function" && symbol.is_module_function) {
			label = "module function";
		}
		if (symbol.kind === "method") {
			label = `${symbol.visibility} method`;
		}
		return this.violation_for(file, symbol.line, label, symbol.name);
	}

	/** Responsibilities: _declaration leading underscore diagnostics_. **/
	public violation_for(file: string, line: number, label: string, name: string): Violation {
		return this.diagnostic_rule.violation(file, line + 1, { label, name });
	}

	/** Responsibilities: _declaration leading underscore reporting_. **/
	public append_declaration_violation(violations: Violation[], file: string, declaration: NamedLine): boolean {
		if (this.allowed_name(declaration.name, "type", "public")) {
			return false;
		}
		violations.push(this.violation_for(file, declaration.line, "type", declaration.name));
		return true;
	}
}
