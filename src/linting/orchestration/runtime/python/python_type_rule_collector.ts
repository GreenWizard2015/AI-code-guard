import { AnyTypes } from "src/rules/typescript/syntax-rules/types/any_types";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type_script_type_aliases";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { ProjectTypeBoundary } from "src/metrics/project-boundary/project_type_boundary";
import type { PythonRuleInput } from "src/linting/types";
import type { PythonTypeRuleCollectorContract } from "src/protocols";
import type { AstCallableNodeContract, AstClassNode } from "src/types";
import { PYTHON_CALLABLE_TYPE_PREFIX, PYTHON_LANGUAGE } from "src/constants";
import type { ProjectTypeBoundaryNames } from "src/metrics/types";

/** Responsibilities: _Python field type checks_, _nested type checks_. **/
export class PythonTypeRuleCollector implements PythonTypeRuleCollectorContract {
	private readonly input: PythonRuleInput;
	private readonly type_field_rule: DiagnosticRule;
	private readonly return_type_rule: DiagnosticRule;
	private readonly parameter_type_rule: DiagnosticRule;
	private readonly field_type_rule: DiagnosticRule;
	private readonly callback_contract_rule: DiagnosticRule;
	private readonly nested_generic_rule: DiagnosticRule;
	private readonly public_state_rule: DiagnosticRule;
	private readonly maximum_callback_parameters = 3;

	/** Responsibilities: _type-field count violations addition_. **/
	private append_type_fields(): void {
		const { violations, file_name, classes } = this.input;
		for (const node of classes) {
			if (node.type_contract !== true && node.protocol !== true) {
				continue;
			}
			const count = node.fields.length;
			if (count > 10) {
				violations.push(this.type_field_rule.violation(file_name.value, node.start + 1, { count: String(count) }));
			}
		}
	}

	/** Responsibilities: _callable type violations addition_. **/
	private append_callable_types(callables: readonly AstCallableNodeContract[]): void {
		const { violations, file_name } = this.input;
		for (const callable of callables) {
			if (!callable.return_type) {
				violations.push(this.return_type_rule.violation(file_name.value, callable.start + 1));
			}
			for (const name of callable.untyped_parameters) {
				violations.push(this.parameter_type_rule.violation(file_name.value, callable.start + 1, { name }));
			}
		}
	}

	/** Responsibilities: _callback annotation parameters_. **/
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

	/** Responsibilities: _callback contract violations_. **/
	private append_callback_contracts(callables: readonly AstCallableNodeContract[]): void {
		const { violations, file_name } = this.input;
		for (const callable of callables) {
			for (const parameter of callable.typed_arguments) {
				const parameters = this.callback_parameters(parameter.type);
				if (parameters.length <= this.maximum_callback_parameters) {
					continue;
				}
				violations.push(this.callback_contract_rule.violation(file_name.value, callable.start + 1, {
					name: callable.name,
					count: String(parameters.length),
				}));
				break;
			}
		}
	}

	/** Responsibilities: _nested generic annotation_. **/
	private nested_annotation(annotation: string): boolean {
		let depth = 0;
		for (const character of annotation) {
			if (character === "[") {
				if (depth > 0) {
					return true;
				}
				depth += 1;
				continue;
			}
			if (character === "]") {
				if (depth > 0) {
					depth -= 1;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _nested generic annotation check_. **/
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

	/** Responsibilities: _nested generic callable violations_. **/
	private append_nested_callables(callables: readonly AstCallableNodeContract[]): void {
		const { violations, file_name } = this.input;
		for (const callable of callables) {
			if (!callable.typed_arguments.some((argument) => this.has_nested_generic(argument.type))) {
				continue;
			}
			violations.push(this.nested_generic_rule.violation(file_name.value, callable.start + 1));
		}
	}

	/** Responsibilities: _nested generic field violations_. **/
	private append_nested_fields(): void {
		const { violations, file_name, classes } = this.input;
		for (const field of classes.flatMap((node) => node.fields)) {
			if (!this.has_nested_generic(field.type)) {
				continue;
			}
			violations.push(this.nested_generic_rule.violation(file_name.value, field.line + 1));
		}
	}

	/** Responsibilities: _mutable collection_. **/
	private mutable_collection_field(type: string): boolean {
		const normalized = type.replace(/\s+/gu, "");
		const bracket = normalized.indexOf("[");
		let base = normalized;
		if (bracket >= 0) {
			base = normalized.slice(0, bracket);
		}
		const dot = base.lastIndexOf(".");
		const name = base.slice(dot + 1);
		return ["list", "dict", "set", "deque", "defaultdict", "MutableMapping", "MutableSequence", "MutableSet"].includes(name);
	}

	/** Responsibilities: _public state_. **/
	private append_public_state(): void {
		const { violations, file_name, classes } = this.input;
		if (file_name.test()) {
			return;
		}
		for (const node of classes) {
			if (node.is_data_class || node.type_contract || node.protocol) {
				continue;
			}
			for (const field of node.fields) {
				if (field.name.startsWith("_") || !this.mutable_collection_field(field.type)) {
					continue;
				}
				violations.push(this.public_state_rule.violation(file_name.value, field.line + 1));
			}
		}
	}

	/** Responsibilities: _field type violations addition_. **/
	private append_field_types(): void {
		const { violations, file_name, classes } = this.input;
		for (const node of classes) {
			for (const field of node.untyped_fields) {
				violations.push(this.field_type_rule.violation(file_name.value, field.line + 1, { name: field.name }));
			}
		}
	}

	/** Responsibilities: _project type contract names_. **/
	private allowed_contracts(classes: readonly AstClassNode[]): Set<string> {
		const declared_contract_names = [...this.input.project_type_names, ...this.input.project_protocol_names];
		const allowed_names = declared_contract_names.filter((name) => !this.input.project_class_names.has(name));
		const allowed = new Set(allowed_names);
		for (const node of classes) {
			if (node.is_data_class) {
				allowed.add(node.name);
			}
		}
		return allowed;
	}

	/** Responsibilities: _Python boundary type names_. **/
	private boundary_names(classes: readonly AstClassNode[]): ProjectTypeBoundaryNames {
		const allowed_contracts = this.allowed_contracts(classes);
		const project_class_names = [...this.input.project_class_names];
		const forbidden_names = project_class_names.filter((name) => !allowed_contracts.has(name));
		const forbidden_project_types = new Set(forbidden_names);
		return {
			project_types: this.input.project_type_names,
			project_class_names: this.input.project_class_names,
			allowed_contracts,
			forbidden_project_types,
			imported_contract_names: new Set(),
			reference_aliases: this.input.reference_aliases,
			language: PYTHON_LANGUAGE,
		};
	}

	/** Responsibilities: _project type boundary violations_. **/
	private append_boundary(callables: readonly AstCallableNodeContract[]): void {
		const { violations, file_name, classes } = this.input;
		if (file_name.test()) {
			return;
		}
		const names = this.boundary_names(classes);
		const boundary = new ProjectTypeBoundary({
			source: {
				violations,
				file: file_name.value,
				callables,
				fields: classes.flatMap((node) => node.fields),
			},
			names,
		});
		boundary.append();
	}

	/** Responsibilities: _Python type rule initialization_. **/
	public constructor(input: PythonRuleInput) {
		this.type_field_rule = new DiagnosticRule("type-field-count");
		this.return_type_rule = new DiagnosticRule("explicit-return-type");
		this.parameter_type_rule = new DiagnosticRule("python-explicit-parameter-type");
		this.field_type_rule = new DiagnosticRule("python-explicit-field-type");
		this.callback_contract_rule = new DiagnosticRule("callback-contract-size");
		this.nested_generic_rule = new DiagnosticRule("nested-generic-type");
		this.public_state_rule = new DiagnosticRule("public-state-exposure");
		this.input = input;
	}

	/** Responsibilities: _Python type rules addition_. **/
	public append_type_rules(): void {
		const { classes, functions } = this.input;
		const callables = functions.concat(classes.flatMap((node) => node.methods));
		this.append_type_fields();
		this.append_callable_types(callables);
		this.append_field_types();
		this.append_boundary(callables);
		this.append_callback_contracts(callables);
		this.append_nested_callables(callables);
		this.append_nested_fields();
		this.append_public_state();
	}

	/** Responsibilities: _Python type information addition_. **/
	public append_type_information(): void {
		const { violations, file_name, classes, functions } = this.input;
		const any_types = new AnyTypes(new TypeScriptTypeAliases());
		any_types.append_any_info(
			violations,
			file_name.value,
			functions,
			classes.flatMap((node) => node.methods),
			classes,
		);
	}
}
