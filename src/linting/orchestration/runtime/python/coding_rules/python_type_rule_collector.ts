import { AnyTypes } from "src/any_types";
import { PythonCallableTypeRules } from "src/linting/orchestration/runtime/python/type_rules/python_callable_type_rules";
import { PythonClassFieldTypeRules } from "src/linting/orchestration/runtime/python/type_rules/python_class_field_type_rules";
import { PythonNestedGenericTypeRules } from "src/linting/orchestration/runtime/python/type_rules/python_nested_generic_type_rules";
import type { PythonRuleInput } from "src/linting/types";
import type { AstCallableNode } from "src/model/ast/normalized_ast_types";
import { TypeScriptTypeAliases } from "src/parser/typescript-aliases/expressions/type_script_type_aliases";
import type { PythonTypeRuleCollectorContract } from "src/python_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _Python type rule coordination_, _Python type metadata collection_. **/
export class PythonTypeRuleCollector implements PythonTypeRuleCollectorContract {
	private readonly _input: PythonRuleInput;
	private readonly _callables: readonly AstCallableNode[];
	private readonly _field_rules: PythonClassFieldTypeRules;
	private readonly _callable_rules: PythonCallableTypeRules;
	private readonly _nested_rules: PythonNestedGenericTypeRules;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _initialization Python type analyses_. **/
	public constructor(input: PythonRuleInput, stage_timer: LintStageTimerContract) {
		this._input = input;
		this._stage_timer = stage_timer;
		this._callables = input.operations.callables;
		this._field_rules = new PythonClassFieldTypeRules(input);
		this._callable_rules = this._stage_timer.measure(
			"rule.callable-type-alias.python.prepare",
			() => new PythonCallableTypeRules(input),
		);
		this._nested_rules = new PythonNestedGenericTypeRules(input, this._callables, input.source.classes);
	}

	/** Responsibilities: _Python type violations_. **/
	public append_type_rules(): void {
		this._field_rules.append_type_fields();
		this._stage_timer.measure("rule.explicit-return-type.python", () => this._callable_rules.append_return_types());
		this._callable_rules.append_parameter_types();
		this._field_rules.append_field_types();
		this._field_rules.append_boundary();
		this._callable_rules.append_callback_contracts();
		this._stage_timer.measure("rule.callable-type-alias.python", () =>
			this._callable_rules.append_callable_aliases(this._stage_timer),
		);
		this._nested_rules.append_callables();
		this._nested_rules.append_fields();
		this._stage_timer.measure("rule.public-state-exposure.python", () => this._field_rules.append_public_state());
	}

	/** Responsibilities: _Python type information_. **/
	public append_type_information(): void {
		const any_types = new AnyTypes(new TypeScriptTypeAliases(), this._stage_timer);
		any_types.append_any_info({
			violations: this._input.violations,
			file: this._input.file_name.value(),
			functions: this._input.source.functions,
			methods: this._input.operations.methods,
			classes: this._input.source.classes,
		});
	}
}
