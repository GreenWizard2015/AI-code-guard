import { MARKDOWN_CONSTANT_ERROR, MARKDOWN_RANGE_ERROR } from "documentation_validation/constants";
import { MarkdownTemplateValues } from "documentation_validation/markdown_template_values";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";

/** Responsibilities: _Markdown template parsing_, _loop expansion_, _placeholder substitution_. **/
export class MarkdownLoopExpander {
	private readonly boundary_failures: SystemFailureClassificationContract;
	private readonly loop_pattern =
		/\{%[\t ]*for[\t ]+([A-Za-z_][A-Za-z0-9_]*)[\t ]+in[\t ]+(range\([0-9]+\)|\[[\s\S]*?\]|[A-Za-z_][A-Za-z0-9_]*)[\t ]*%\}([\s\S]*?)\{%[\t ]*endfor[\t ]*%\}/u;
	private readonly constant_pattern = /\{%[\t ]*const[\t ]+([A-Za-z_][A-Za-z0-9_]*)[\t ]*=[\t ]*([\s\S]*?)[\t ]*%\}/gu;
	private readonly constant_start_pattern = /\{%[\t ]*const\b/u;
	private readonly start_pattern = /\{%[\t ]*for\b/u;
	private readonly end_pattern = /\{%[\t ]*endfor[\t ]*%\}/u;

	/** Responsibilities: _scoped Markdown template expansion_. **/
	private expand_block(markdown: string): string {
		const constants = this.constants(markdown);
		const without_constants = markdown.replace(this.constant_pattern, "");
		if (this.constant_start_pattern.test(without_constants)) {
			throw new Error("Malformed Markdown constant; expected {% const name = JSON_VALUE %}.");
		}
		const expanded_loops = this.expand_loops(without_constants, constants);
		return this.render_iteration(expanded_loops, this.constant_bindings(constants));
	}

	/** Responsibilities: _template constant parsing_. **/
	private constants(markdown: string): ReadonlyMap<string, string> {
		const constants = new Map<string, string>();
		for (const match of markdown.matchAll(this.constant_pattern)) {
			const name = match[1];
			const literal = match[2];
			if (name === undefined || literal === undefined) {
				throw new Error(MARKDOWN_CONSTANT_ERROR);
			}
			constants.set(name, this.constant_value(name, literal, constants));
		}
		return constants;
	}

	/** Responsibilities: _constant name validation_, _constant JSON validation_. **/
	private constant_value(name: string, literal: string, constants: ReadonlyMap<string, string>): string {
		if (constants.has(name)) {
			throw new Error(MARKDOWN_CONSTANT_ERROR);
		}
		try {
			JSON.parse(literal);
			return literal;
		} catch (error) {
			if (!this.boundary_failures.json_parse_failure(String(error))) {
				throw error;
			}
			throw new Error(`Markdown constant ${name} must have a JSON value: ${String(error)}`);
		}
	}

	/** Responsibilities: _constant placeholder binding_. **/
	private constant_bindings(constants: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
		const bindings = new Map<string, string>();
		for (const [name, literal] of constants) {
			bindings.set(name, String(JSON.parse(literal)));
		}
		return bindings;
	}

	/** Responsibilities: _loop substitution_, _malformed loop rejection_. **/
	private expand_loops(markdown: string, constants: ReadonlyMap<string, string>): string {
		let expanded = markdown;
		while (this.contains_loop(expanded)) {
			const match = this.loop_pattern.exec(expanded);
			if (match === null) {
				throw new Error("Malformed Markdown loop; expected {% for name in [...] %}...{% endfor %}.");
			}
			expanded = expanded.replace(match[0], this.render_loop(match, constants));
		}
		return expanded;
	}

	/** Responsibilities: _single loop rendering_. **/
	private render_loop(match: RegExpExecArray, constants: ReadonlyMap<string, string>): string {
		const variable = match[1];
		const values_expression = match[2];
		const body = match[3];
		if (variable === undefined || values_expression === undefined || body === undefined) {
			throw new Error("Markdown loop is missing its variable, values, or body.");
		}
		if (this.contains_loop(body)) {
			throw new Error("Nested Markdown loops are not supported.");
		}
		const values_literal = this.loop_values(values_expression, constants);
		const template_values = new MarkdownTemplateValues(values_literal, variable, this.boundary_failures);
		return template_values.render(body);
	}

	/** Responsibilities: _loop source resolution_. **/
	private loop_values(expression: string, constants: ReadonlyMap<string, string>): string {
		if (expression.startsWith("[")) {
			return expression;
		}
		if (expression.startsWith("range(")) {
			return this.range_values(expression);
		}
		const literal = constants.get(expression);
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
		return JSON.stringify([...Array(count).keys()]);
	}

	/** Responsibilities: _constant placeholder substitution_. **/
	private render_iteration(body: string, bindings: ReadonlyMap<string, string>): string {
		let rendered = body;
		for (const [name, value] of bindings) {
			const escaped_name = name.replaceAll(".", "\\.");
			const placeholder = new RegExp(`\\{\\{\\s*${escaped_name}\\s*\\}\\}`, "gu");
			rendered = rendered.replace(placeholder, () => value);
		}
		return rendered;
	}

	/** Responsibilities: _fenced template expansion_. **/
	private expand_fenced_block(fence: string): string {
		const fence_pattern = /^(```[^\r\n]*\r?\n)([\s\S]*?)(^```[\t ]*$)/mu;
		const match = fence_pattern.exec(fence);
		if (match === null) {
			return fence;
		}
		const opening = match[1];
		const body = match[2];
		const closing = match[3];
		if (opening === undefined || body === undefined || closing === undefined) {
			return fence;
		}
		return opening + this.expand_block(body) + closing;
	}

	/** Responsibilities: _template parser dependency ownership_. **/
	public constructor(boundary_failures: SystemFailureClassificationContract) {
		this.boundary_failures = boundary_failures;
	}

	/** Responsibilities: _loop template expansion_. **/
	public expand(markdown: string): string {
		if (!markdown.includes("```")) {
			return markdown;
		}
		return markdown.replace(/^(```[^\r\n]*\r?\n)([\s\S]*?)(^```[\t ]*$)/gmu, (fence) =>
			this.expand_fenced_block(fence),
		);
	}

	/** Responsibilities: _loop syntax detection_. **/
	public contains_loop(markdown: string): boolean {
		return this.start_pattern.test(markdown) || this.end_pattern.test(markdown);
	}
}
