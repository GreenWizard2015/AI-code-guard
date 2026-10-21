import { NamingValidation } from "src/rules/naming_validation";
import { TestPathSyntax } from "src/test_path_syntax";
import type { LeadingUnderscoreNamingContract } from "src/shared_services_protocols";
import type { NamingSupportContract, NamingValidationContract } from "src/analysis_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstClassNodeContract, NamedLine, NamedSymbol } from "src/types";
import { NUMERIC_NAME_PATTERN } from "src/rules/constants";
import { METRIC_KIND_FUNCTION } from "src/metrics/constants";

/** Responsibilities: _symbol names_, _name constraints_. **/
export class NamingSupport implements NamingSupportContract {
	private readonly leading_underscore_naming: LeadingUnderscoreNamingContract;
	private readonly naming_validation: NamingValidationContract;

	/** Responsibilities: _retrieval normalization declarations lint_. **/
	private source_declarations(declarations: NamedLine[], classes: AstClassNodeContract[]): NamedLine[] {
		if (declarations.length > 0) {
			return declarations;
		}
		return classes.map((node) => ({ name: node.name, line: node.start }));
	}

	/** Responsibilities: _aggregation type-name violation named_. **/
	private append_type_violation(violations: ViolationContract[], file: string, declaration: NamedLine): void {
		const words = this.naming_validation.name_words(declaration.name);
		if (this.leading_underscore_naming.append_declaration_violation(violations, file, declaration)) {
			return;
		}
		if (this.naming_validation.valid_name(declaration.name, "type", false, words, "public")) {
			return;
		}
		violations.push(
			this.naming_validation.naming_violation(file, declaration.line, declaration.name, "type", words.length),
		);
	}

	/** Responsibilities: _numeric name violations_. **/
	private append_numeric_name(
		violations: ViolationContract[],
		file: string,
		name: string,
		line: number,
		reported: Set<string>,
	): void {
		const key = `${line}:${name}`;
		if (reported.has(key)) {
			return;
		}
		const naming_validation: NamingValidationContract = new NamingValidation();
		if (!NUMERIC_NAME_PATTERN.test(name)) {
			return;
		}
		reported.add(key);
		violations.push(naming_validation.numeric_name_violation(file, line));
	}

	/** Responsibilities: _numeric fields_. **/
	private append_numeric_fields(
		violations: ViolationContract[],
		file: string,
		classes: AstClassNodeContract[],
		reported: Set<string>,
	): void {
		for (const class_node of classes) {
			for (const field of class_node.fields) {
				this.append_numeric_name(violations, file, field.name, field.line, reported);
			}
		}
	}

	/** Responsibilities: _classification method externally visible_. **/
	private external_method(kind: string, name: string, line: number, classes: AstClassNodeContract[]): boolean {
		if (kind !== "method") {
			return false;
		}
		return classes.some(
			(class_node) =>
				class_node.extends_external_class &&
				class_node.methods.some((method) => method.name === name && method.start === line),
		);
	}

	/** Responsibilities: _leading underscore violation label_. **/
	private leading_underscore_label(symbol: NamedSymbol): string {
		if (symbol.kind !== METRIC_KIND_FUNCTION) {
			if (symbol.kind === "method") {
				return `${symbol.visibility} method`;
			}
			return symbol.kind;
		}
		if (symbol.is_module_function) {
			return "module function";
		}
		return METRIC_KIND_FUNCTION;
	}

	/** Responsibilities: _numeric symbols_. **/
	private append_numeric_symbols(
		violations: ViolationContract[],
		file: string,
		symbols: NamedSymbol[],
		reported: Set<string>,
	): void {
		for (const symbol of symbols) {
			this.append_numeric_name(violations, file, symbol.name, symbol.line, reported);
		}
	}

	/** Responsibilities: _numeric declarations_. **/
	private append_numeric_declarations(
		violations: ViolationContract[],
		file: string,
		declarations: NamedLine[],
		reported: Set<string>,
	): void {
		for (const declaration of declarations) {
			this.append_numeric_name(violations, file, declaration.name, declaration.line, reported);
		}
	}

	/** Responsibilities: _numeric names_. **/
	private append_numeric_violations(
		violations: ViolationContract[],
		file: string,
		symbols: NamedSymbol[],
		classes: AstClassNodeContract[],
		declarations: NamedLine[],
	): void {
		const reported = new Set<string>();
		this.append_numeric_symbols(violations, file, symbols, reported);
		this.append_numeric_declarations(violations, file, declarations, reported);
		if (file.endsWith(".py")) {
			this.append_numeric_fields(violations, file, classes, reported);
		}
	}

	/** Responsibilities: _naming dependency initialization_. **/
	public constructor(leading_underscore_naming: LeadingUnderscoreNamingContract) {
		this.naming_validation = new NamingValidation();
		this.leading_underscore_naming = leading_underscore_naming;
	}

	/** Responsibilities: _naming violations normalization_. **/
	public append_naming_violations(
		violations: ViolationContract[],
		file: string,
		symbols: NamedSymbol[],
		classes: AstClassNodeContract[],
		type_declarations: NamedLine[],
	): void {
		const test_path_syntax = new TestPathSyntax();

		if (test_path_syntax.test_file(file)) {
			return;
		}
		const declarations = this.source_declarations(type_declarations, classes);
		this.append_numeric_violations(violations, file, symbols, classes, declarations);
		for (const symbol of symbols) {
			this.append_symbol_violations(violations, file, symbol, classes);
		}
		for (const declaration of declarations) {
			this.append_type_violation(violations, file, declaration);
		}
	}

	/** Responsibilities: _aggregation symbol naming type_. **/
	public append_symbol_violations(
		violations: ViolationContract[],
		file: string,
		symbol: NamedSymbol,
		classes: AstClassNodeContract[],
	): void {
		const { name, kind, line } = symbol;
		if (this.external_method(kind, name, line, classes)) {
			return;
		}
		if (!this.leading_underscore_naming.allowed(symbol)) {
			violations.push(
				this.leading_underscore_naming.violation_for(
					file,
					symbol.line,
					this.leading_underscore_label(symbol),
					symbol.name,
				),
			);
			return;
		}
		if (symbol.is_module_constant === true || symbol.is_module_variable === true) {
			return;
		}
		this.naming_validation.append_standard_violation(violations, file, symbol);
	}
}
