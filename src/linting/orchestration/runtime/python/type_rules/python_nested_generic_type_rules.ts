import { PYTHON_CALLABLE_TYPE_PREFIX } from "src/constants";
import type { PythonRuleInput } from "src/linting/types";
import type { AstCallableNode, AstClassNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _callable annotation checks_, _field annotation checks_. **/
export class PythonNestedGenericTypeRules {
	private readonly _input: PythonRuleInput;
	private readonly _callables: readonly AstCallableNode[];
	private readonly _classes: readonly AstClassNode[];
	private readonly _rule: RuleContract;

	/** Responsibilities: _nested generic syntax classification_. **/
	private nested_annotation(type_expression: string): boolean {
		let depth = 0;
		for (const character of type_expression) {
			if (character === "[") {
				if (depth > 0) {
					return true;
				}
				depth += 1;
				continue;
			}
			if (character === "]" && depth > 0) {
				depth -= 1;
			}
		}
		return false;
	}

	/** Responsibilities: _nested generic annotation lookup_. **/
	private has_nested_generic(annotation: string): boolean {
		const normalized = annotation.replace(/\s+/gu, "");
		if (!normalized.startsWith(PYTHON_CALLABLE_TYPE_PREFIX)) {
			return this.nested_annotation(normalized);
		}
		const parameter_end = normalized.indexOf("],", PYTHON_CALLABLE_TYPE_PREFIX.length);
		if (parameter_end < 0) {
			return this.nested_annotation(normalized);
		}
		return this.nested_annotation(normalized.slice(parameter_end + 2));
	}

	/** Responsibilities: _initialization nested generic analysis_. **/
	public constructor(input: PythonRuleInput, callables: readonly AstCallableNode[], classes: readonly AstClassNode[]) {
		this._input = input;
		this._callables = callables;
		this._classes = classes;
		this._rule = new DiagnosticRule("nested-generic-type");
	}

	/** Responsibilities: _nested generic callable violations_. **/
	public append_callables(): void {
		for (const callable of this._callables) {
			if (!callable.signature.typed_arguments.some((argument) => this.has_nested_generic(argument.type))) {
				continue;
			}
			this._input.violations.push(this._rule.violation(this._input.file_name.value(), callable.identity.start + 1, {}));
		}
	}

	/** Responsibilities: _nested generic field violations_. **/
	public append_fields(): void {
		for (const field of this._classes.flatMap((node) => node.field_analysis.fields)) {
			if (this.has_nested_generic(field.type)) {
				this._input.violations.push(this._rule.violation(this._input.file_name.value(), field.line + 1, {}));
			}
		}
	}
}
