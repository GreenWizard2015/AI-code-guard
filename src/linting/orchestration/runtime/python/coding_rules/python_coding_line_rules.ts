import { PYTHON_RULE_IDS } from "src/linting/constants";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _Python syntax_, _forbidden syntax_. **/
export class PythonCodingLineRules {
	private readonly _reflection_calls: readonly string[];
	private readonly _python_only_reflections: ReadonlySet<string>;
	private readonly _type_call: string;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _classification qualified decorator_. **/
	private is_decorator(trimmed: string, decorator_name: string): boolean {
		if (trimmed === `@${decorator_name}`) {
			return true;
		}
		if (!trimmed.startsWith("@")) {
			return false;
		}
		return trimmed.endsWith(`.${decorator_name}`);
	}

	/** Responsibilities: _reflection helper name mapping_. **/
	private reflection_rule_name(reflection_name: string): string {
		if (this._python_only_reflections.has(reflection_name)) {
			return `python-${reflection_name}`;
		}
		return reflection_name;
	}

	/** Responsibilities: _classification source line contains_. **/
	private contains_call(source: string, call_name: string): boolean {
		const index = source.indexOf(`${call_name}(`);
		if (index < 0) {
			return false;
		}
		if (!this.is_boundary(source.slice(index - 1, index))) {
			return false;
		}
		const end = index + call_name.length;
		return this.is_boundary(source.slice(end, end + 1));
	}

	/** Responsibilities: _classification source line assigns_. **/
	private is_type_assignment(assignment_line: string): boolean {
		const equals = assignment_line.indexOf("=");
		if (equals <= 0) {
			return false;
		}
		return assignment_line
			.slice(equals + 1)
			.trimStart()
			.startsWith(this._type_call);
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

	/** Responsibilities: _broad exception detection_. **/
	private broad_except(exception_line: string): boolean {
		return this._stage_timer.measure(`rule.${PYTHON_RULE_IDS.broad_except}`, () => {
			const is_bare_except = exception_line === "except:";
			return is_bare_except || exception_line.startsWith("except Exception:");
		});
	}

	/** Responsibilities: _Python coding-rule configuration_. **/
	/** Responsibilities: _Python coding-rule configuration_. **/
	public constructor(
		reflection_calls: readonly string[],
		python_only_reflections: ReadonlySet<string>,
		type_call: string,
		stage_timer: LintStageTimerContract,
	) {
		this._reflection_calls = reflection_calls;
		this._python_only_reflections = python_only_reflections;
		this._type_call = type_call;
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _public operation_. **/
	public base_line_kinds(line_text: string): string[] {
		const kinds: string[] = [];
		if (this.broad_except(line_text)) {
			kinds.push(PYTHON_RULE_IDS.broad_except);
		}
		const static_method = this._stage_timer.measure(`rule.${PYTHON_RULE_IDS.static_method}`, () =>
			this.is_decorator(line_text, "staticmethod"),
		);
		if (static_method) {
			kinds.push(PYTHON_RULE_IDS.static_method);
		}
		const class_method = this._stage_timer.measure(`rule.${PYTHON_RULE_IDS.class_method}`, () =>
			this.is_decorator(line_text, "classmethod"),
		);
		if (class_method) {
			kinds.push(PYTHON_RULE_IDS.class_method);
		}
		return kinds;
	}

	/** Responsibilities: _collection invalid coding-rule kinds_. **/
	public invalid_line_kinds(source: string): string[] {
		const trimmed = source.trim();
		const kinds = this.base_line_kinds(trimmed);
		for (const name of this._reflection_calls) {
			const rule_id = this.reflection_rule_name(name);
			const found = this._stage_timer.measure(`rule.${rule_id}`, () => this.contains_call(source, name));
			if (found) {
				kinds.push(rule_id);
			}
		}
		const dynamic_type = this._stage_timer.measure(`rule.${PYTHON_RULE_IDS.dynamic_type}`, () =>
			this.is_type_assignment(trimmed),
		);
		if (dynamic_type) {
			kinds.push(PYTHON_RULE_IDS.dynamic_type);
		}
		return kinds;
	}
}
