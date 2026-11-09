import { CALLABLE_TYPE_NAME, PYTHON_CALLABLE_TYPE_PREFIX } from "src/constants";
import type { PythonRuleInput, PythonRuleSource } from "src/linting/types";
import type { AstCallableNode, NamedLine } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _callable annotation checks_, _callback contract limits_. **/
export class PythonCallableTypeRules {
	private readonly _file: string;
	private readonly _violations: ViolationContract[];
	private readonly _callables: readonly AstCallableNode[];
	private readonly _source: PythonRuleSource;
	private readonly _source_lines: readonly string[];
	private readonly _return_type_rule: RuleContract;
	private readonly _parameter_type_rule: RuleContract;
	private readonly _callback_contract_rule: RuleContract;
	private readonly _callable_alias_rule: RuleContract;
	private readonly maximum_callback_parameters = 3;
	private readonly _callable_type_names: ReadonlySet<string>;

	/** Responsibilities: _callback annotation parameter names_. **/
	private callback_parameters(annotation: string): readonly string[] {
		const normalized = annotation.replace(/\s+/gu, "");
		const prefix = PYTHON_CALLABLE_TYPE_PREFIX;
		if (!normalized.startsWith(prefix)) {
			return [];
		}
		const end = normalized.indexOf("],", prefix.length);
		if (end < 0) {
			return [];
		}
		const parameters = normalized.slice(prefix.length, end);
		if (parameters.length === 0) {
			return [];
		}
		return parameters.split(",");
	}

	/** Responsibilities: _inline Python Callable classification_. **/
	private inline_callable_type(annotation: string): boolean {
		const normalized = annotation.replace(/\s+/gu, "");
		for (const name of this._callable_type_names) {
			if (normalized === name) {
				return true;
			}
			if (normalized.startsWith(`${name}[`)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _Python source line lookup_. **/
	private source_line(line_number: number): string {
		for (const [index, source_line] of this._source_lines.entries()) {
			if (index === line_number) {
				return source_line;
			}
		}
		return "";
	}

	/** Responsibilities: _misnamed callable alias detection_. **/
	private append_callable_alias(declaration: NamedLine): void {
		const declaration_text = this.source_line(declaration.line);
		const assignment = declaration_text.indexOf("=");
		if (assignment < 0) {
			return;
		}
		const alias_expression = declaration_text.slice(assignment + 1);
		if (!this.inline_callable_type(alias_expression)) {
			return;
		}
		if (declaration.name.startsWith(CALLABLE_TYPE_NAME)) {
			return;
		}
		this._violations.push(this._callable_alias_rule.violation(this._file, declaration.line + 1, {}));
	}

	/** Responsibilities: _Callable parameter type analysis_. **/
	private append_callable_parameters(callable: AstCallableNode): void {
		for (const argument of callable.signature.typed_arguments) {
			if (this.inline_callable_type(argument.type)) {
				this._violations.push(this._callable_alias_rule.violation(this._file, callable.identity.start + 1, {}));
			}
		}
	}

	/** Responsibilities: _Callable result type analysis_. **/
	private append_callable_result(callable: AstCallableNode): void {
		if (!this.inline_callable_type(callable.signature.return_type)) {
			return;
		}
		this._violations.push(this._callable_alias_rule.violation(this._file, callable.identity.start + 1, {}));
	}

	/** Responsibilities: _Callable field type analysis_. **/
	private append_callable_fields(): void {
		for (const class_node of this._source.classes) {
			for (const field of class_node.field_analysis.fields) {
				if (this.inline_callable_type(field.type)) {
					this._violations.push(this._callable_alias_rule.violation(this._file, field.line + 1, {}));
				}
			}
		}
	}

	/** Responsibilities: _callable alias diagnostics_. **/
	private append_callable_declarations(): void {
		for (const declaration of this._source.type_declarations) {
			this.append_callable_alias(declaration);
		}
	}

	/** Responsibilities: _inline callable signature diagnostics_. **/
	private append_callable_signatures(): void {
		for (const callable of this._callables) {
			this.append_callable_parameters(callable);
			this.append_callable_result(callable);
		}
	}

	/** Responsibilities: _callable rule setup_. **/
	public constructor(input: PythonRuleInput) {
		this._file = input.file_name.value();
		this._violations = input.violations;
		this._callables = input.operations.callables;
		this._source = input.source;
		this._source_lines = input.source.text.split("\n");
		this._callable_type_names = new Set([
			CALLABLE_TYPE_NAME,
			`typing.${CALLABLE_TYPE_NAME}`,
			`collections.abc.${CALLABLE_TYPE_NAME}`,
		]);
		this._return_type_rule = new DiagnosticRule("explicit-return-type");
		this._parameter_type_rule = new DiagnosticRule("python-explicit-parameter-type");
		this._callback_contract_rule = new DiagnosticRule("callback-contract-size");
		this._callable_alias_rule = new DiagnosticRule("callable-type-alias");
	}

	/** Responsibilities: _callable type validation_. **/
	public append_return_types(): void {
		for (const callable of this._callables) {
			if (!callable.signature.return_type) {
				this._violations.push(this._return_type_rule.violation(this._file, callable.identity.start + 1, {}));
			}
		}
	}

	/** Responsibilities: _callable parameter type validation_. **/
	public append_parameter_types(): void {
		for (const callable of this._callables) {
			for (const name of callable.signature.untyped_parameters) {
				this._violations.push(this._parameter_type_rule.violation(this._file, callable.identity.start + 1, { name }));
			}
		}
	}

	/** Responsibilities: _oversized callback contract violations_. **/
	public append_callback_contracts(): void {
		for (const callable of this._callables) {
			for (const parameter of callable.signature.typed_arguments) {
				const parameters = this.callback_parameters(parameter.type);
				if (parameters.length <= this.maximum_callback_parameters) {
					continue;
				}
				this._violations.push(
					this._callback_contract_rule.violation(this._file, callable.identity.start + 1, {
						name: callable.identity.name,
						count: String(parameters.length),
					}),
				);
				break;
			}
		}
	}

	/** Responsibilities: _inline callable type diagnostics_. **/
	public append_callable_aliases(stage_timer: LintStageTimerContract): void {
		stage_timer.measure("rule.callable-type-alias.python.declarations", () => this.append_callable_declarations());
		stage_timer.measure("rule.callable-type-alias.python.signatures", () => this.append_callable_signatures());
		stage_timer.measure("rule.callable-type-alias.python.fields", () => this.append_callable_fields());
	}
}
