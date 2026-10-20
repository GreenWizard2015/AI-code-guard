import { ViolationValue } from "src/violation_value";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import { RULE_DATA_BY_ID, RULE_LANGUAGE_BY_ID } from "src/constants";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { AstLanguage, RuleParameters } from "src/types";

/** Responsibilities: _rule metadata resolution_, _diagnostic violations rendering_. **/
export class DiagnosticRule implements RuleContract {
	private readonly rule_id: string;
	private readonly rule_message: string;
	private readonly rule_hint: string;
	private readonly rule_priority: number;

	/** Responsibilities: _resolution diagnostic template parameter_. **/
	private parameter_value(parameters: RuleParameters, name: string): string {
		for (const [parameter_name, value] of Object.entries(parameters)) {
			if (parameter_name !== name) {
				continue;
			}
			if (value === undefined) {
				throw new Error(`Rule "${this.rule_id}" is missing message parameter "${name}".`);
			}
			return String(value);
		}
		throw new Error(`Rule "${this.rule_id}" is missing message parameter "${name}".`);
	}

	/** Responsibilities: _diagnostic template rendering_. **/
	private render_template(template: string, parameters: RuleParameters): string {
		let rendered = template;
		for (const match of template.matchAll(/\{([a-zA-Z0-9_]+)\}/gu)) {
			const name = match[1];
			if (name === undefined) {
				continue;
			}
			rendered = rendered.replace(match[0], String(this.parameter_value(parameters, name)));
		}
		return rendered;
	}

	/** Responsibilities: _source file language resolution_. **/
	private source_language(file: string): AstLanguage {
		if (file.toLowerCase().endsWith(".py")) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}

	/** Responsibilities: _initialization rule metadata rule_. **/
	public constructor(rule_id: string) {
		const data = RULE_DATA_BY_ID.get(rule_id);
		if (data === undefined) {
			throw new Error(`Unknown coding rule "${rule_id}".`);
		}
		this.rule_id = rule_id;
		this.rule_message = data.message;
		this.rule_hint = data.hint;
		this.rule_priority = data.priority;
	}

	/** Responsibilities: _rule source-language support_. **/
	public supports_file(file: string): boolean {
		const language = RULE_LANGUAGE_BY_ID.get(this.rule_id);
		if (language === undefined) {
			return true;
		}
		return this.source_language(file) === language;
	}

	/** Responsibilities: _creation rendered diagnostic violation_. **/
	public violation(file: string, line: number, parameters: RuleParameters = {}): ViolationContract {
		const language = RULE_LANGUAGE_BY_ID.get(this.rule_id);
		if (!this.supports_file(file)) {
			const file_language = this.source_language(file);
			throw new Error(`Rule "${this.rule_id}" is registered for ${language}, not ${file_language}.`);
		}
		const message_parameters = parameters;
		return new ViolationValue({
			file,
			line,
			message: this.render_template(this.rule_message, message_parameters),
			hint: this.render_template(this.rule_hint, message_parameters),
			rule_id: this.rule_id,
			priority: this.rule_priority,
		});
	}
}
