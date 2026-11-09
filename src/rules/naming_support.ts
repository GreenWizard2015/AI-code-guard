import type { NamingValidationContract, NumericNameReportingContext } from "src/analysis_protocols";
import { TEST_PATH_SUFFIXES, TYPE_FIELD_SYMBOL_KIND } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { METRIC_KIND_FUNCTION } from "src/metrics/constants";
import type { AstClassNode, NamedLine, NamedSymbol } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { NUMERIC_NAME_PATTERN, NUMERIC_NAME_RULE_ID } from "src/rules/constants";
import { NamingValidation } from "src/rules/naming_validation";
import type { LintStageTimerContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _symbol names_, _name constraints_. **/
export class NamingSupport {
	private readonly _file: string;
	private readonly _symbols: readonly NamedSymbol[];
	private readonly _classes: readonly AstClassNode[];
	private readonly _type_declarations: readonly NamedLine[];
	private readonly _naming_validation: NamingValidationContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _retrieval normalization declarations lint_. **/
	private source_declarations(
		declarations: readonly NamedLine[],
		class_declarations: readonly AstClassNode[],
	): NamedLine[] {
		if (declarations.length > 0) {
			return [...declarations];
		}
		return class_declarations.map((node) => ({ name: node.identity.name, line: node.identity.start }));
	}

	/** Responsibilities: _aggregation type-name violation named_. **/
	private append_type_violation(
		type_violations: ViolationContract[],
		source_file: string,
		declaration: NamedLine,
	): void {
		if (!this.leading_underscore_allowed(declaration.name, "type", "public")) {
			const rule = new DiagnosticRule("naming-private");
			type_violations.push(
				rule.violation(source_file, declaration.line + 1, { label: "type", name: declaration.name }),
			);
			return;
		}
		this._naming_validation.append_type_violation(type_violations, declaration);
	}

	/** Responsibilities: _leading underscore name policy_. **/
	private leading_underscore_allowed(symbol_name: string, symbol_kind: string, visibility: string): boolean {
		if (!symbol_name.startsWith("_")) {
			return true;
		}
		if (/^_+$/u.test(symbol_name) || symbol_kind === "field" || symbol_kind === TYPE_FIELD_SYMBOL_KIND) {
			return true;
		}
		if (symbol_kind !== "method") {
			return false;
		}
		if (/^__.*__$/u.test(symbol_name)) {
			return true;
		}
		return visibility === "private";
	}

	/** Responsibilities: _numeric name violations_. **/
	private append_numeric_name(
		numeric_context: NumericNameReportingContext,
		candidate_name: string,
		line: number,
	): void {
		const key = `${line}:${candidate_name}`;
		if (numeric_context.reported.has(key)) {
			return;
		}
		if (!NUMERIC_NAME_PATTERN.test(candidate_name)) {
			return;
		}
		numeric_context.reported.add(key);
		numeric_context.violations.push(this._naming_validation.numeric_name_violation(line));
	}

	/** Responsibilities: _numeric fields_. **/
	private append_numeric_fields(field_context: NumericNameReportingContext, class_nodes: AstClassNode[]): void {
		for (const class_node of class_nodes) {
			for (const field of class_node.field_analysis.fields) {
				this.append_numeric_name(field_context, field.name, field.line);
			}
		}
	}

	/** Responsibilities: _classification method externally visible_. **/
	private external_method(
		symbol_kind: string,
		method_name: string,
		line: number,
		external_class_nodes: readonly AstClassNode[],
	): boolean {
		if (symbol_kind !== "method") {
			return false;
		}
		return external_class_nodes.some(
			(class_node) =>
				class_node.classification.extends_external_class &&
				class_node.structure.methods.some(
					(method) => method.identity.name === method_name && method.identity.start === line,
				),
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
	private append_numeric_symbols(symbol_context: NumericNameReportingContext, symbols: readonly NamedSymbol[]): void {
		for (const symbol of symbols) {
			this.append_numeric_name(symbol_context, symbol.name, symbol.line);
		}
	}

	/** Responsibilities: _numeric declarations_. **/
	private append_numeric_declarations(
		declaration_context: NumericNameReportingContext,
		declarations: readonly NamedLine[],
	): void {
		for (const declaration of declarations) {
			this.append_numeric_name(declaration_context, declaration.name, declaration.line);
		}
	}

	/** Responsibilities: _aggregation symbol naming type_. **/
	private append_symbol(
		symbol_violations: ViolationContract[],
		symbol: NamedSymbol,
		method_owner_classes: readonly AstClassNode[],
	): void {
		const { name, kind, line } = symbol;
		if (this.external_method(kind, name, line, method_owner_classes)) {
			return;
		}
		if (!this.leading_underscore_allowed(name, kind, symbol.visibility)) {
			const rule = new DiagnosticRule("naming-private");
			symbol_violations.push(
				rule.violation(this._file, symbol.line + 1, {
					label: this.leading_underscore_label(symbol),
					name: symbol.name,
				}),
			);
			return;
		}
		if (symbol.is_module_constant === true || symbol.is_module_variable === true) {
			return;
		}
		this._naming_validation.append_standard_violation(symbol_violations, symbol);
	}

	/** Responsibilities: _naming dependency initialization_. **/
	public constructor(
		file: string,
		symbols: readonly NamedSymbol[],
		classes: readonly AstClassNode[],
		type_declarations: readonly NamedLine[],
		stage_timer: LintStageTimerContract,
	) {
		this._file = file;
		this._symbols = symbols;
		this._classes = classes;
		this._type_declarations = type_declarations;
		this._naming_validation = new NamingValidation(file);
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _symbol naming diagnostics_. **/
	public append_symbol_violations(symbol_violations: ViolationContract[]): void {
		if (this._test_path_syntax.classify(this._file).has(TestPathKind.TestFile)) {
			return;
		}
		this._stage_timer.measure(`rule.${RULE_IDS.naming}`, () => {
			for (const symbol of this._symbols) {
				this.append_symbol(symbol_violations, symbol, this._classes);
			}
		});
	}

	/** Responsibilities: _type declaration naming diagnostics_. **/
	public append_type_violations(type_violations: ViolationContract[]): void {
		if (this._test_path_syntax.classify(this._file).has(TestPathKind.TestFile)) {
			return;
		}
		this._stage_timer.measure(`rule.${RULE_IDS.naming_type}`, () => {
			const declarations = this.source_declarations(this._type_declarations, this._classes);
			for (const declaration of declarations) {
				this.append_type_violation(type_violations, this._file, declaration);
			}
		});
	}

	/** Responsibilities: _numeric identifier diagnostics_. **/
	public append_numeric_violations(numeric_violations: ViolationContract[]): void {
		if (this._test_path_syntax.classify(this._file).has(TestPathKind.TestFile)) {
			return;
		}
		const context: NumericNameReportingContext = { violations: numeric_violations, reported: new Set<string>() };
		this._stage_timer.measure(`rule.${NUMERIC_NAME_RULE_ID}`, () => {
			this.append_numeric_symbols(context, this._symbols);
			this.append_numeric_declarations(context, this.source_declarations(this._type_declarations, this._classes));
			if (this._file.endsWith(".py")) {
				this.append_numeric_fields(context, [...this._classes]);
			}
		});
	}

	/** Responsibilities: _numeric symbol diagnostics_. **/
	public report_symbol_numbers(violations: ViolationContract[]): void {
		if (this._test_path_syntax.classify(this._file).has(TestPathKind.TestFile)) {
			return;
		}
		this._stage_timer.measure(`rule.${NUMERIC_NAME_RULE_ID}`, () => {
			this.append_numeric_symbols({ violations, reported: new Set<string>() }, this._symbols);
		});
	}

	/** Responsibilities: _numeric declaration diagnostics_. **/
	public report_declaration_numbers(violations: ViolationContract[]): void {
		if (this._test_path_syntax.classify(this._file).has(TestPathKind.TestFile)) {
			return;
		}
		this._stage_timer.measure(`rule.${NUMERIC_NAME_RULE_ID}`, () => {
			const declarations = this.source_declarations(this._type_declarations, this._classes);
			this.append_numeric_declarations({ violations, reported: new Set<string>() }, declarations);
		});
	}
}
