import { LintFileName } from "src/core/context/lint_file_name";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import type { AstCallableNode, AstClassNode, AstTypeKind, AstVisibility } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { FixtureLists } from "tests/core/fixture-lists";
import type { FixtureCallableNode, FixtureClassNode } from "tests/core/types";

/** Responsibilities: _AST fixture normalization_, _class diagnostic setup_. **/
export class FixtureAstMapper {
	/** Responsibilities: _text fixture normalization_. **/
	private text_value<T>(value: T): string {
		if (typeof value === "string") {
			return value;
		}
		return "";
	}

	/** Responsibilities: _number fixture normalization_. **/
	private number_value<T>(value: T, fallback: number): number {
		if (typeof value === "number") {
			return value;
		}
		return fallback;
	}

	/** Responsibilities: _boolean fixture normalization_. **/
	private flag_value<T>(value: T): boolean {
		return value === true;
	}

	/** Responsibilities: _visibility fixture normalization_. **/
	private visibility_value<T>(value: T): AstVisibility {
		if (value === "private" || value === "protected") {
			if (value === "private") {
				return "private";
			}
			return "protected";
		}
		return "public";
	}

	/** Responsibilities: _type-kind fixture normalization_. **/
	private type_kind_value<T>(value: T): AstTypeKind {
		const logical_condition_1 = value === "named" || value === "generic" || value === "template";
		if (logical_condition_1) {
			if (value === "named") {
				return "named";
			}
			if (value === "generic") {
				return "generic";
			}
			return "template";
		}
		return "basic";
	}

	/** Responsibilities: _class fixture diagnostics_. **/
	public append_class_violations(violations: ViolationContract[], file: string, node: FixtureClassNode): void {
		const normalized_node = this.class_node(node);
		const file_name = new LintFileName(file);
		const structure = new ClassStructureReporter({
			violations,
			file_name,
			node: normalized_node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			project_class_names: new Set(normalized_node.structure.base_class_names),
			project_contract_names: new Set(normalized_node.structure.interfaces ?? []),
			project_alias_names: new Set(),
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
		});
		structure.report_class_methods();
		structure.report_design();
		structure.report_sizes();
	}

	/** Responsibilities: _callable AST fixture_. **/
	public callable_node(node: FixtureCallableNode): AstCallableNode {
		const lists = new FixtureLists(node);
		const default_lines = this.number_value(node.end, 0) - this.number_value(node.start, 0);
		return {
			identity: {
				name: this.text_value(node.name),
				owner: this.text_value(node.owner),
				nested: false,
				start: this.number_value(node.start, 0),
				end: this.number_value(node.end, 0),
				visibility: this.visibility_value(node.visibility),
			},
			metrics: {
				argument_count: this.number_value(node.argument_count, 0),
				lines: this.number_value(node.lines, default_lines + 1),
				sloc: this.number_value(node.sloc, default_lines + 1),
				characters: this.number_value(node.characters, 0),
				control_flow_depth: this.number_value(node.control_flow_depth, 0),
			},
			signature: {
				statements: lists._statements,
				parameter_types: lists._parameter_types,
				return_type: this.text_value(node.return_type),
				argument_uses: lists._argument_uses,
				typed_arguments: lists._typed_arguments,
				untyped_parameters: lists._untyped_parameters,
			},
			test_behavior: {
				exception_only: this.flag_value(node.exception_only),
				has_unittest_assertion: this.flag_value(node.has_unittest_assertion),
				unittest_assertion_alias: this.flag_value(node.unittest_assertion_alias),
				unittest_exception_only: this.flag_value(node.unittest_exception_only),
				test_exception_bypass: this.flag_value(node.test_exception_bypass),
				unittest_ending_valid: this.flag_value(node.unittest_ending_valid),
				unittest_assertion_count: this.number_value(node.unittest_assertion_count, 0),
			},
			declaration: {
				decorators: lists._decorators,
				is_accessor: this.flag_value(node.is_accessor),
				has_self: this.flag_value(node.has_self),
			},
		};
	}

	/** Responsibilities: _class AST fixture_. **/
	public class_node(node: FixtureClassNode): AstClassNode {
		const lists = new FixtureLists({});
		lists.constructor_lists(node);
		const default_lines = this.number_value(node.end, 0) - this.number_value(node.start, 0);
		return {
			identity: {
				name: this.text_value(node.name),
				start: this.number_value(node.start, 0),
				end: this.number_value(node.end, 0),
				lines: this.number_value(node.lines, default_lines + 1),
				sloc: this.number_value(node.sloc, default_lines + 1),
			},
			structure: {
				methods: lists._methods.map((method) => this.callable_node(method)),
				interfaces: lists._interfaces,
				base_class_names: lists._base_class_names,
				dependencies: lists._dependencies,
			},
			classification: {
				extends_external_class: this.flag_value(node.extends_external_class),
				is_data_class: this.flag_value(node.is_data_class),
				type_contract: this.flag_value(node.type_contract),
				protocol: this.flag_value(node.protocol),
			},
			field_analysis: {
				callback_fields: this.number_value(node.callback_fields, 0),
				inline_callback_fields: this.number_value(node.inline_callback_fields, 0),
				fields: lists._fields.map((field) => ({
					line: this.number_value(field.line, 0),
					name: this.text_value(field.name),
					value_name: this.text_value(field.value_name),
					type: this.text_value(field.type),
					type_kind: this.type_kind_value(field.type_kind),
					readonly: this.flag_value(field.readonly),
					class_variable: this.flag_value(field.class_variable),
					class_scope: this.flag_value(field.class_scope),
					visibility: "public",
				})),
				untyped_fields: [...(node.untyped_fields ?? [])],
			},
		};
	}
}
