import { MARKDOWN_LOOP_OBJECT_ERROR, MARKDOWN_LOOP_VALUE_ERROR } from "documentation_validation/constants";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";

/** Responsibilities: _Markdown loop value ownership_, _placeholder binding_. **/
export class MarkdownTemplateValues {
	private readonly boundary_failures: SystemFailureClassificationContract;
	private readonly variable: string;
	private readonly values_literal: string;

	/** Responsibilities: _JSON loop value parsing_. **/
	private parsed_values(): string[] {
		let parsed: unknown;
		try {
			parsed = JSON.parse(this.values_literal);
		} catch (error) {
			if (!this.boundary_failures.json_parse_failure(String(error))) {
				throw error;
			}
			throw new Error(`Markdown loop values must be a JSON array of strings, numbers, or booleans: ${String(error)}`);
		}
		if (!Array.isArray(parsed)) {
			throw new Error("Markdown loop values must be a JSON array.");
		}
		return parsed.map((item) => {
			const item_json = JSON.stringify(item);
			if (item_json === undefined) {
				throw new Error(MARKDOWN_LOOP_VALUE_ERROR);
			}
			return item_json;
		});
	}

	/** Responsibilities: _single loop item bindings_. **/
	private item_bindings(item_json: string): ReadonlyMap<string, string> {
		if (item_json === "null") {
			throw new Error(MARKDOWN_LOOP_VALUE_ERROR);
		}
		if (item_json.startsWith("[")) {
			throw new Error(MARKDOWN_LOOP_VALUE_ERROR);
		}
		if (!item_json.startsWith("{")) {
			return new Map([[this.variable, String(JSON.parse(item_json))]]);
		}
		return this.object_bindings(item_json);
	}

	/** Responsibilities: _object loop property bindings_. **/
	private object_bindings(item_json: string): ReadonlyMap<string, string> {
		const item = JSON.parse(item_json);
		const bindings = new Map<string, string>([[this.variable, item_json]]);
		for (const [name, property] of Object.entries(item)) {
			const property_json = JSON.stringify(property);
			if (property_json === undefined) {
				throw new Error(MARKDOWN_LOOP_OBJECT_ERROR);
			}
			this.append_property_binding(bindings, name, property_json);
		}
		return bindings;
	}

	/** Responsibilities: _object property map update_. **/
	private append_property_binding(bindings: Map<string, string>, name: string, property_json: string): void {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
			throw new Error(MARKDOWN_LOOP_OBJECT_ERROR);
		}
		if (property_json === "null") {
			throw new Error(MARKDOWN_LOOP_OBJECT_ERROR);
		}
		if (property_json.startsWith("[") || property_json.startsWith("{")) {
			throw new Error(MARKDOWN_LOOP_OBJECT_ERROR);
		}
		bindings.set(`${this.variable}.${name}`, String(JSON.parse(property_json)));
	}

	/** Responsibilities: _single loop iteration substitution_. **/
	private render_iteration(body: string, bindings: ReadonlyMap<string, string>): string {
		let rendered = body;
		for (const [name, value] of bindings) {
			const escaped_name = name.replaceAll(".", "\\.");
			const placeholder = new RegExp(`\\{\\{\\s*${escaped_name}\\s*\\}\\}`, "gu");
			rendered = rendered.replace(placeholder, () => value);
		}
		return rendered;
	}

	/** Responsibilities: _loop value source initialization_. **/
	public constructor(values_literal: string, variable: string, boundary_failures: SystemFailureClassificationContract) {
		this.values_literal = values_literal;
		this.variable = variable;
		this.boundary_failures = boundary_failures;
	}

	/** Responsibilities: _loop iteration bindings_. **/
	public bindings(): readonly ReadonlyMap<string, string>[] {
		return this.parsed_values().map((item) => this.item_bindings(item));
	}

	/** Responsibilities: _rendered loop iterations_. **/
	public render(body: string): string {
		return this.bindings()
			.map((bindings) => this.render_iteration(body, bindings))
			.join("");
	}
}
