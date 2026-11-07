import { MARKDOWN_CONSTANT_ERROR, MARKDOWN_RANGE_ERROR } from "documentation_validation/constants";
import { MarkdownTemplateValues } from "documentation_validation/markdown_template_values";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";

/** Responsibilities: _fenced block template_, _scoped constant ownership_. **/
export class MarkdownTemplateBlock {
	private readonly _body: string;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _constants: Map<string, string>;
	private readonly _loop_pattern: RegExp;
	private readonly _constant_pattern: RegExp;
	private readonly _constant_start_pattern: RegExp;
	private readonly _start_pattern: RegExp;
	private readonly _end_pattern: RegExp;
	private readonly _template_pattern: RegExp;

	/** Responsibilities: _template constant parsing_. **/
	private initialize_constants(): void {
		for (const match of this._body.matchAll(this._constant_pattern)) {
			const name = match[1];
			const literal = match[2];
			if (name === undefined || literal === undefined) {
				throw new Error(MARKDOWN_CONSTANT_ERROR);
			}
			this.constant_value(name, literal);
		}
	}

	/** Responsibilities: _constant JSON validation_. **/
	private constant_value(name: string, literal: string): void {
		if (this._constants.has(name)) {
			throw new Error(MARKDOWN_CONSTANT_ERROR);
		}
		try {
			JSON.parse(literal);
			this._constants.set(name, literal);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.JsonParse)) {
				throw error;
			}
			throw new Error(`Markdown constant ${name} must have a JSON value: ${String(error)}`);
		}
	}

	/** Responsibilities: _constant placeholder binding_. **/
	private constant_bindings(): ReadonlyMap<string, string> {
		const bindings = new Map<string, string>();
		for (const [name, literal] of this._constants) {
			bindings.set(name, String(JSON.parse(literal)));
		}
		return bindings;
	}

	/** Responsibilities: _loop source resolution_. **/
	private loop_values(expression: string): string {
		if (expression.startsWith("[")) {
			return expression;
		}
		if (expression.startsWith("range(")) {
			return this.range_values(expression);
		}
		const literal = this._constants.get(expression);
		if (literal === undefined) {
			throw new Error(`Markdown loop references unknown constant ${expression}.`);
		}
		return literal;
	}

	/** Responsibilities: _bounded numeric loop generation_. **/
	private range_values(expression: string): string {
		if (!/^range\([0-9]+\)$/u.test(expression)) {
			throw new Error(MARKDOWN_RANGE_ERROR);
		}
		const count = Number(expression.slice(6, -1));
		const unsafe_count = !Number.isSafeInteger(count);
		const exceeds_limit = count > 10_000;
		if (unsafe_count || exceeds_limit) {
			throw new Error(MARKDOWN_RANGE_ERROR);
		}
		const indexes = new Array<number>(count);
		return JSON.stringify([...indexes.keys()]);
	}

	/** Responsibilities: _single loop rendering_. **/
	private render_loop(match: RegExpExecArray): string {
		const variable = match[1];
		const values_expression = match[2];
		const loop_body = match[3];
		if (variable === undefined || values_expression === undefined || loop_body === undefined) {
			throw new Error("Markdown loop is missing its variable, values, or body.");
		}
		if (this._start_pattern.test(loop_body) || this._end_pattern.test(loop_body)) {
			throw new Error("Nested Markdown loops are not supported.");
		}
		const values_literal = this.loop_values(values_expression);
		const template_values = new MarkdownTemplateValues(values_literal, variable, this._boundary_failures);
		return template_values.render(loop_body);
	}

	/** Responsibilities: _loop substitution_, _malformed loop rejection_. **/
	private expand_loops(loop_source_text: string): string {
		let expanded = loop_source_text;
		while (this._start_pattern.test(expanded) || this._end_pattern.test(expanded)) {
			const match = this._loop_pattern.exec(expanded);
			if (match === null) {
				throw new Error("Malformed Markdown loop; expected {% for name in [...] %}...{% endfor %}.");
			}
			expanded = expanded.replace(match[0], this.render_loop(match));
		}
		return expanded;
	}

	/** Responsibilities: _constant placeholder substitution_. **/
	private render_constants(render_source_text: string, bindings: ReadonlyMap<string, string>): string {
		let rendered = render_source_text;
		for (const [name, value] of bindings) {
			const escaped_name = name.replaceAll(".", "\\.");
			const placeholder = new RegExp(`\\{\\{\\s*${escaped_name}\\s*\\}\\}`, "gu");
			rendered = rendered.replace(placeholder, () => value);
		}
		return rendered;
	}

	/** Responsibilities: _Markdown template initialization_. **/
	public constructor(body: string, boundary_failures: SystemFailureClassificationContract) {
		this._body = body;
		this._boundary_failures = boundary_failures;
		this._constants = new Map<string, string>();
		this._loop_pattern =
			/\{%[\t ]*for[\t ]+([A-Za-z_][A-Za-z0-9_]*)[\t ]+in[\t ]+(range\([0-9]+\)|\[[\s\S]*?\]|[A-Za-z_][A-Za-z0-9_]*)[\t ]*%\}([\s\S]*?)\{%[\t ]*endfor[\t ]*%\}(?:\r?\n)?/u;
		this._constant_pattern = /\{%[\t ]*const[\t ]+([A-Za-z_][A-Za-z0-9_]*)[\t ]*=[\t ]*([\s\S]*?)[\t ]*%\}/gu;
		this._constant_start_pattern = /\{%[\t ]*const\b/u;
		this._start_pattern = /\{%[\t ]*for\b/u;
		this._end_pattern = /\{%[\t ]*endfor[\t ]*%\}/u;
		this._template_pattern = /\{%[\t ]*(?:for|endfor|const)\b/u;
	}

	/** Responsibilities: _template syntax detection_. **/
	public contains_template(): boolean {
		if (!this._body.includes("{%")) {
			return false;
		}
		return this._template_pattern.test(this._body);
	}

	/** Responsibilities: _code block template expansion_. **/
	public expand(): string {
		this.initialize_constants();
		const without_constants = this._body.replace(this._constant_pattern, "");
		if (this._constant_start_pattern.test(without_constants)) {
			throw new Error("Malformed Markdown constant; expected {% const name = JSON_VALUE %}.");
		}
		const expanded_loops = this.expand_loops(without_constants);
		return this.render_constants(expanded_loops, this.constant_bindings());
	}
}
