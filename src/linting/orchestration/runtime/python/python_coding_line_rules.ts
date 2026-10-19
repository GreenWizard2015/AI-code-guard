import { PYTHON_RULE_IDS } from "src/constants";
import {
	PYTHON_ONLY_REFLECTIONS,
	PYTHON_REFLECTION_CALLS,
	PYTHON_TYPE_CALL,
} from "src/linting/orchestration/runtime/constants";

/** Responsibilities: _Python syntax_, _forbidden syntax_. **/
export class PythonCodingLineRules {
	private readonly reflection_calls = PYTHON_REFLECTION_CALLS;
	private readonly python_only_reflections: Set<string>;
	private readonly type_call = PYTHON_TYPE_CALL;

	/** Responsibilities: _classification qualified decorator_. **/
	private is_decorator(trimmed: string, name: string): boolean {
		if (trimmed === `@${name}`) {
			return true;
		}
		if (!trimmed.startsWith("@")) {
			return false;
		}
		return trimmed.endsWith(`.${name}`);
	}

	/** Responsibilities: _reflection helper name mapping_. **/
	private reflection_rule_name(name: string): string {
		if (this.python_only_reflections.has(name)) {
			return `python-${name}`;
		}
		return name;
	}

	/** Responsibilities: _classification source line contains_. **/
	private contains_call(source: string, name: string): boolean {
		const index = source.indexOf(`${name}(`);
		if (index < 0) {
			return false;
		}
		if (!this.is_boundary(source[index - 1])) {
			return false;
		}
		return this.is_boundary(source[index + name.length]);
	}

	/** Responsibilities: _classification source line assigns_. **/
	private is_type_assignment(source: string): boolean {
		const equals = source.indexOf("=");
		if (equals <= 0) {
			return false;
		}
		return source
			.slice(equals + 1)
			.trimStart()
			.startsWith(this.type_call);
	}

	/** Responsibilities: _classification characters terminate Python_. **/
	private is_boundary(character: string): boolean {
		if (character.length === 0) {
			return true;
		}
		const is_underscore = character === "_";
		const is_dollar = character === "$";
		if (is_underscore || is_dollar) {
			return false;
		}
		return !this.is_or_digit(character);
	}

	/** Responsibilities: _classification uppercase numeric identifier_. **/
	private is_or_digit(character: string): boolean {
		const uppercase_start = character >= "A";
		const uppercase_end = character <= "Z";
		if (uppercase_start && uppercase_end) {
			return true;
		}
		const lowercase_start = character >= "a";
		const lowercase_end = character <= "z";
		if (lowercase_start && lowercase_end) {
			return true;
		}
		const digit_start = character >= "0";
		const digit_end = character <= "9";
		return digit_start && digit_end;
	}

	/** Responsibilities: _collection rule kinds represented_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.python_only_reflections = PYTHON_ONLY_REFLECTIONS;
	}
	/** Responsibilities: _public operation_. **/
	public base_line_kinds(trimmed: string): string[] {
		const kinds: string[] = [];
		const is_bare_except = trimmed === "except:";
		if (is_bare_except || trimmed.startsWith("except Exception:")) {
			kinds.push(PYTHON_RULE_IDS.broad_except);
		}
		if (this.is_decorator(trimmed, "staticmethod")) {
			kinds.push(PYTHON_RULE_IDS.static_method);
		}
		if (this.is_decorator(trimmed, "classmethod")) {
			kinds.push(PYTHON_RULE_IDS.class_method);
		}
		return kinds;
	}

	/** Responsibilities: _collection invalid coding-rule kinds_. **/
	public invalid_line_kinds(source: string): string[] {
		const trimmed = source.trim();
		const kinds = this.base_line_kinds(trimmed);
		for (const name of this.reflection_calls) {
			if (this.contains_call(source, name)) {
				kinds.push(this.reflection_rule_name(name));
			}
		}
		if (this.is_type_assignment(trimmed)) {
			kinds.push(PYTHON_RULE_IDS.dynamic_type);
		}
		return kinds;
	}
}
