import { AnyTypes } from "src/rules/typescript/any-types";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type-aliases";
import { DiagnosticRule } from "src/model/diagnostic-rule";
import { ProjectTypeBoundary } from "src/metrics/project-type-boundary";
import type { PythonRuleInput } from "src/runner/types";
import type { AstCallableNode, AstClassNode } from "src/types";

/** Responsibilities: _Python type rule collection_. **/
export class PythonTypeRuleCollector {
	private readonly input: PythonRuleInput;
	private readonly type_field_rule = new DiagnosticRule("type-field-count");
	private readonly return_type_rule = new DiagnosticRule("explicit-return-type");
	private readonly parameter_type_rule = new DiagnosticRule("python-explicit-parameter-type");
	private readonly field_type_rule = new DiagnosticRule("python-explicit-field-type");

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
	private append_callable_types(callables: readonly AstCallableNode[]): void {
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
		const allowed = new Set(
			[...this.input.project_type_names].filter((name) => !this.input.project_class_names.has(name)),
		);
		for (const name of this.input.project_protocol_names) {
			allowed.add(name);
		}
		for (const node of classes) {
			if (node.is_data_class) {
				allowed.add(node.name);
			}
		}
		return allowed;
	}

	/** Responsibilities: _project type boundary violations_. **/
	private append_boundary(callables: readonly AstCallableNode[]): void {
		const { violations, file_name, classes } = this.input;
		if (file_name.test()) {
			return;
		}
		const boundary = new ProjectTypeBoundary({
			violations,
			file: file_name.value,
			callables,
			project_types: this.input.project_type_names,
			allowed_contracts: this.allowed_contracts(classes),
			reference_aliases: this.input.reference_aliases,
			language: "python",
		});
		boundary.append();
	}

	/** Responsibilities: _Python type rule initialization_. **/
	public constructor(input: PythonRuleInput) {
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
	}

	/** Responsibilities: _Python type information addition_. **/
	public append_type_information(): void {
		const { violations, file_name, classes, functions } = this.input;
		const any_types = new AnyTypes(new TypeScriptTypeAliases());
		any_types.append_any_info(
			violations,
			file_name.value,
			functions.concat(classes.flatMap((node) => node.methods)),
			classes,
		);
	}
}
