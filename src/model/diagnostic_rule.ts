import { PYTHON_LANGUAGE, RULE_DATA_BY_ID, RULE_LANGUAGE_BY_ID, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { DiagnosticRuleData } from "src/model/types";
import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";
import type { RuleParameters } from "src/types";

/** Responsibilities: _rule metadata resolution_, _diagnostic violations rendering_. **/
export class DiagnosticRule implements DiagnosticRuleContract {
	private readonly _rule_id: string;
	private readonly _rule_data: DiagnosticRuleData;

	/** Responsibilities: _resolution diagnostic template parameter_. **/
	private parameter_value(rule_parameters: RuleParameters, name: string): string {
		for (const [parameter_name, value] of Object.entries(rule_parameters)) {
			if (parameter_name !== name) {
				continue;
			}
			if (value === undefined) {
				throw new Error(`Rule "${this._rule_id}" is missing message parameter "${name}".`);
			}
			return String(value);
		}
		throw new Error(`Rule "${this._rule_id}" is missing message parameter "${name}".`);
	}

	/** Responsibilities: _diagnostic template rendering_. **/
	private render_template(template: string, template_parameters: RuleParameters): string {
		let rendered = template;
		for (const match of template.matchAll(/\{([a-zA-Z0-9_]+)\}/gu)) {
			const name = match[1];
			if (name === undefined) {
				continue;
			}
			rendered = rendered.replace(match[0], String(this.parameter_value(template_parameters, name)));
		}
		return rendered;
	}

	/** Responsibilities: _source file language resolution_. **/
	private source_language(source_path: string): AstLanguage {
		if (source_path.toLowerCase().endsWith(".py")) {
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
		this._rule_id = rule_id;
		this._rule_data = data;
	}

	/** Responsibilities: _rule source-language support_. **/
	public supports_file(candidate_path: string): boolean {
		const language = RULE_LANGUAGE_BY_ID.get(this._rule_id);
		if (language === undefined) {
			return true;
		}
		return this.source_language(candidate_path) === language;
	}

	/** Responsibilities: _creation rendered diagnostic violation_. **/
	public violation(target_file: string, line: number, violation_parameters: RuleParameters = {}): ViolationContract {
		const language = RULE_LANGUAGE_BY_ID.get(this._rule_id);
		if (!this.supports_file(target_file)) {
			const file_language = this.source_language(target_file);
			throw new Error(`Rule "${this._rule_id}" is registered for ${language}, not ${file_language}.`);
		}
		const message_parameters = violation_parameters;
		return new ViolationValue({
			file: target_file,
			line,
			message: this.render_template(this._rule_data.message, message_parameters),
			hint: this.render_template(this._rule_data.hint, message_parameters),
			rule_id: this._rule_id,
			priority: this._rule_data.priority,
		});
	}
}
