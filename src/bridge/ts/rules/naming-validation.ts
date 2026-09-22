import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { ViolationContent } from 'src/bridge/ts/rules/types';
import {
	MAX_NAME_WORDS,
	PASCAL_CASE_PATTERN,
	SNAKE_CASE_PATTERN,
	UPPER_CASE_PATTERN,
} from 'src/bridge/ts/rules/constants';

/** Responsibilities: _validation symbol names cases_. **/
export class NamingValidation {
	private readonly max_name_words = MAX_NAME_WORDS;
	private readonly snake_case_pattern = SNAKE_CASE_PATTERN;
	private readonly upper_case_pattern = UPPER_CASE_PATTERN;
	private readonly pascal_case_pattern = PASCAL_CASE_PATTERN;

	/** Responsibilities: _validation symbol name against_. **/
	private valid_symbol_name(
		name: string,
		kind: string,
		is_module_constant: boolean,
		words: string[]
	): boolean {
		const is_snake_case = this.snake_case_pattern.test(name);
		if (!this.valid_case_name(name)) {
			return false;
		}
		if (is_snake_case && kind === 'constant' && is_module_constant) {
			return false;
		}
		return words.length <= this.max_name_words;
	}

	/** Responsibilities: _classification name follows configuration_. **/
	private valid_case_name(name: string): boolean {
		const is_snake_case = this.snake_case_pattern.test(name);
		const is_upper_case = this.upper_case_pattern.test(name);
		const starts_dunder = name.startsWith('__');
		if (!starts_dunder) {
			return is_snake_case || is_upper_case;
		}
		const is_dunder = name.endsWith('__');
		if (is_snake_case) {
			return true;
		}
		if (is_upper_case) {
			return true;
		}
		return is_dunder;
	}

	/** Responsibilities: _construction naming violation message_. **/
	private naming_content(name: string, kind: string, word_count: number): ViolationContent {
		if (kind === 'type' || kind === 'type_alias') {
			let label = 'type alias';
			if (kind === 'type') {
				label = 'type';
			}
			return {
				rule_id: 'naming-type',
				parameters: { label, name },
			};
		}
		return {
			rule_id: 'naming',
			parameters: { kind, name, word_count: String(word_count) },
		};
	}

	/** Responsibilities: _symbol name normalization segmentation_. **/
	public name_words(name: string): string[] {
		const without_hashes = name.replace(/^#+/u, '');
		const with_separators = without_hashes.replace(/([a-z0-9])([A-Z])/gu, '$1_$2');
		const normalized = with_separators.replace(/^_+|_+$/gu, '');
		return normalized.split('_').filter(word => word.length > 0);
	}

	/** Responsibilities: _reporting symbol name satisfies_. **/
	public valid_name(
		name: string,
		kind: string,
		is_module_constant: boolean,
		words: string[]
	): boolean {
		if (name === '_') {
			return true;
		}
		if (kind === 'type_alias' || kind === 'type') {
			return this.pascal_case_pattern.test(name);
		}
		return this.valid_symbol_name(name, kind, is_module_constant, words);
	}

	/** Responsibilities: _creation naming violation invalid_. **/
	public naming_violation(
		file: string,
		line: number,
		name: string,
		kind: string,
		word_count: number
	): Violation {
		const content = this.naming_content(name, kind, word_count);
		const rule = new DiagnosticRule(content.rule_id);
		return rule.violation(file, line + 1, content.parameters);
	}
}
