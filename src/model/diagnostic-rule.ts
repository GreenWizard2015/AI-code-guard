import { Violation as ViolationClass } from 'src/parser/ts/violation';
import { RULE_DATA } from 'src/parser/ts/constants';
import type { Rule, Violation } from 'src/protocols';
import type { RuleParameters } from 'src/types';

/** Responsibilities: _rule metadata resolution_, _diagnostic violations rendering_. **/
export class DiagnosticRule implements Rule {
	private readonly rule_id: string;
	private readonly rule_message: string;
	private readonly rule_hint: string;
	private readonly rule_priority: number;
	private readonly rule_data = new Map(Object.entries(RULE_DATA));

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

	/** Responsibilities: _initialization rule metadata rule_. **/
	public constructor(rule_id: string) {
		const data = this.rule_data.get(rule_id);
		if (data === undefined) {
			throw new Error(`Unknown coding rule "${rule_id}".`);
		}
		this.rule_id = rule_id;
		this.rule_message = data.message;
		this.rule_hint = data.hint;
		this.rule_priority = data.priority;
	}

	/** Responsibilities: _creation rendered diagnostic violation_. **/
	public violation(
		file: string,
		line: number,
		parameters: RuleParameters = {},
	): Violation {
		const message_parameters = parameters;
		return new ViolationClass({
			file,
			line,
			message: this.render_template(this.rule_message, message_parameters),
			hint: this.render_template(this.rule_hint, message_parameters),
			rule_id: this.rule_id,
			priority: this.rule_priority,
		});
	}
}
