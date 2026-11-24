import type { NamingValidationContract } from "src/analysis_protocols";
import { MODULE_CONSTANT_KIND, MODULE_TYPE_KIND, TYPE_ALIAS_KIND, TYPE_FIELD_SYMBOL_KIND } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import type { NamedSymbol } from "src/model/ast/normalized_ast_types";
import type { NamedLine } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContent } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { MAX_NAME_WORDS, PASCAL_CASE_PATTERN, SNAKE_CASE_PATTERN, UPPER_CASE_PATTERN } from "src/rules/constants";

/** Responsibilities: _symbol naming validation_, _name-specific diagnostic reporting_. **/
export class NamingValidation implements NamingValidationContract {
	private readonly _file: string;
	private readonly _word_cache: Map<string, readonly string[]>;
	private readonly _max_name_words: number;
	private readonly _snake_case_pattern: RegExp;
	private readonly _upper_case_pattern: RegExp;
	private readonly _pascal_case_pattern: RegExp;

	/** Responsibilities: _validation symbol name against_. **/
	private valid_symbol_name(
		symbol_name: string,
		symbol_kind: string,
		is_module_constant: boolean,
		words: readonly string[],
	): boolean {
		const is_snake_case = this._snake_case_pattern.test(symbol_name);
		if (!this.valid_case_name(symbol_name)) {
			return false;
		}
		const is_constant = symbol_kind === MODULE_CONSTANT_KIND;
		if (is_snake_case && is_constant && is_module_constant) {
			return false;
		}
		return words.length <= this._max_name_words;
	}

	/** Responsibilities: _classification name follows configuration_. **/
	private valid_case_name(case_candidate: string): boolean {
		const is_snake_case = this._snake_case_pattern.test(case_candidate);
		const is_upper_case = this._upper_case_pattern.test(case_candidate);
		const starts_dunder = case_candidate.startsWith("__");
		if (!starts_dunder) {
			return is_snake_case || is_upper_case;
		}
		const is_dunder = case_candidate.endsWith("__");
		if (is_snake_case) {
			return true;
		}
		if (is_upper_case) {
			return true;
		}
		return is_dunder;
	}

	/** Responsibilities: _classification leading underscore allowance_. **/
	private leading_underscore_allowed(
		underscore_candidate: string,
		underscore_kind: string,
		visibility: string,
	): boolean {
		if (!underscore_candidate.startsWith("_")) {
			return true;
		}
		if (/^_+$/u.test(underscore_candidate) || underscore_kind === "field") {
			return true;
		}
		if (underscore_kind === TYPE_FIELD_SYMBOL_KIND) {
			return false;
		}
		return underscore_kind === "method" && (/^__.*__$/u.test(underscore_candidate) || visibility === "private");
	}

	/** Responsibilities: _construction naming violation message_. **/
	private naming_content(display_name: string, display_kind: string, word_count: number): ViolationContent {
		let normalized_kind = display_kind;
		if (display_kind === TYPE_FIELD_SYMBOL_KIND) {
			normalized_kind = "field";
		}
		const is_type = normalized_kind === MODULE_TYPE_KIND || normalized_kind === TYPE_ALIAS_KIND;
		if (is_type) {
			let label = "type alias";
			if (normalized_kind === "type") {
				label = "type";
			}
			return {
				rule_id: RULE_IDS.naming_type,
				parameters: { label, name: display_name },
			};
		}
		return {
			rule_id: RULE_IDS.naming,
			parameters: { kind: normalized_kind, name: display_name, word_count: String(word_count) },
		};
	}

	/** Responsibilities: _reporting symbol name satisfies_. **/
	private valid_name(
		candidate_name: string,
		candidate_kind: string,
		is_module_constant: boolean,
		words: readonly string[],
		visibility = "public",
	): boolean {
		if (!this.leading_underscore_allowed(candidate_name, candidate_kind, visibility)) {
			return false;
		}
		if (/^_+$/u.test(candidate_name)) {
			return true;
		}
		const is_type = candidate_kind === TYPE_ALIAS_KIND || candidate_kind === MODULE_TYPE_KIND;
		if (is_type) {
			return this._pascal_case_pattern.test(candidate_name);
		}
		return this.valid_symbol_name(candidate_name, candidate_kind, is_module_constant, words);
	}

	/** Responsibilities: _creation naming violation invalid_. **/
	private naming_violation(
		diagnostic_file: string,
		diagnostic_line: number,
		name: string,
		violation_kind: string,
		word_count: number,
	): ViolationContract {
		const content = this.naming_content(name, violation_kind, word_count);
		const rule = new DiagnosticRule(content.rule_id);
		return rule.violation(diagnostic_file, diagnostic_line + 1, content.parameters);
	}

	/** Responsibilities: _naming analysis cache initialization_. **/
	public constructor(file: string) {
		this._file = file;
		this._word_cache = new Map<string, readonly string[]>();
		this._max_name_words = MAX_NAME_WORDS;
		this._snake_case_pattern = SNAKE_CASE_PATTERN;
		this._upper_case_pattern = UPPER_CASE_PATTERN;
		this._pascal_case_pattern = PASCAL_CASE_PATTERN;
	}

	/** Responsibilities: _symbol name normalization segmentation_. **/
	public name_words(word_source: string): readonly string[] {
		const cached_words = this._word_cache.get(word_source);
		if (cached_words !== undefined) {
			return cached_words;
		}
		const without_hashes = word_source.replace(/^#+/u, "");
		const with_separators = without_hashes.replace(/([a-z0-9])([A-Z])/gu, "$1_$2");
		const normalized = with_separators.replace(/^_+|_+$/gu, "");
		const words = normalized.split("_").filter((word) => word.length > 0);
		this._word_cache.set(word_source, words);
		return words;
	}

	/** Responsibilities: _standard symbol naming violations_. **/
	public append_standard_violation(violations: ViolationContract[], symbol: NamedSymbol): void {
		if (symbol.kind === TYPE_FIELD_SYMBOL_KIND && symbol.name.startsWith("_")) {
			const rule = new DiagnosticRule("naming-private");
			violations.push(rule.violation(this._file, symbol.line + 1, { label: "field", name: symbol.name }));
			return;
		}
		const words = this.name_words(symbol.name);
		if (this.valid_name(symbol.name, symbol.kind, symbol.is_module_constant, words, symbol.visibility)) {
			return;
		}
		violations.push(this.naming_violation(this._file, symbol.line, symbol.name, symbol.kind, words.length));
	}

	/** Responsibilities: _type declaration name diagnostics_. **/
	public append_type_violation(violations: ViolationContract[], declaration: NamedLine): void {
		const words = this.name_words(declaration.name);
		if (this.valid_name(declaration.name, "type", false, words)) {
			return;
		}
		violations.push(this.naming_violation(this._file, declaration.line, declaration.name, "type", words.length));
	}

	/** Responsibilities: _creation numeric name violation_. **/
	public numeric_name_violation(line: number): ViolationContract {
		const rule = new DiagnosticRule("numeric-name");
		return rule.violation(this._file, line + 1);
	}
}
