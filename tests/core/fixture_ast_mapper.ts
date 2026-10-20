import { LintFileName } from "src/core/context/lint_file_name";
import { ClassReporting } from "src/core/support/source-analysis/class_reporting";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstCallableNodeContract, AstClassNode, AstTypeKind, AstVisibility } from "src/types";
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
		const class_reporting = new ClassReporting();
		class_reporting.report_class_methods(violations, file_name, normalized_node);
		const structure = new ClassStructureReporter(violations, file_name, normalized_node);
		structure.report_design();
		structure.report_sizes();
	}

	/** Responsibilities: _callable AST fixture_. **/
	public callable_node(node: FixtureCallableNode): AstCallableNodeContract {
		const lists = new FixtureLists(node);
		const default_lines = this.number_value(node.end, 0) - this.number_value(node.start, 0);
		return {
			name: this.text_value(node.name),
			owner: this.text_value(node.owner),
			nested: false,
			start: this.number_value(node.start, 0),
			end: this.number_value(node.end, 0),
			argument_count: this.number_value(node.argument_count, 0),
			lines: this.number_value(node.lines, default_lines + 1),
			sloc: this.number_value(node.sloc, default_lines + 1),
			characters: this.number_value(node.characters, 0),
			control_flow_depth: this.number_value(node.control_flow_depth, 0),
			statements: lists.statements,
			parameter_types: lists.parameter_types,
			untyped_parameters: lists.untyped_parameters,
			return_type: this.text_value(node.return_type),
			argument_uses: lists.argument_uses,
			typed_arguments: lists.typed_arguments,
			decorators: lists.decorators,
			is_accessor: this.flag_value(node.is_accessor),
			exception_only: this.flag_value(node.exception_only),
			has_self: this.flag_value(node.has_self),
			has_unittest_assertion: this.flag_value(node.has_unittest_assertion),
			unittest_assertion_alias: this.flag_value(node.unittest_assertion_alias),
			unittest_exception_only: this.flag_value(node.unittest_exception_only),
			test_exception_bypass: this.flag_value(node.test_exception_bypass),
			unittest_ending_valid: this.flag_value(node.unittest_ending_valid),
			unittest_assertion_count: this.number_value(node.unittest_assertion_count, 0),
			visibility: this.visibility_value(node.visibility),
		};
	}

	/** Responsibilities: _class AST fixture_. **/
	public class_node(node: FixtureClassNode): AstClassNode {
		const lists = new FixtureLists({});
		lists.constructor_lists(node);
		const default_lines = this.number_value(node.end, 0) - this.number_value(node.start, 0);
		return {
			name: this.text_value(node.name),
			start: this.number_value(node.start, 0),
			end: this.number_value(node.end, 0),
			methods: lists.methods.map((method) => this.callable_node(method)),
			lines: this.number_value(node.lines, default_lines + 1),
			sloc: this.number_value(node.sloc, default_lines + 1),
			interfaces: lists.interfaces,
			base_class_name: this.text_value(node.base_class_name),
			base_class_names: lists.base_class_names,
			extends_external_class: this.flag_value(node.extends_external_class),
			is_data_class: this.flag_value(node.is_data_class),
			type_contract: this.flag_value(node.type_contract),
			protocol: this.flag_value(node.protocol),
			callback_fields: this.number_value(node.callback_fields, 0),
			inline_callback_fields: this.number_value(node.inline_callback_fields, 0),
			fields: lists.fields.map((field) => ({
				line: this.number_value(field.line, 0),
				name: this.text_value(field.name),
				value_name: this.text_value(field.value_name),
				type: this.text_value(field.type),
				type_kind: this.type_kind_value(field.type_kind),
				readonly: this.flag_value(field.readonly),
				class_variable: this.flag_value(field.class_variable),
				visibility: "public",
			})),
			untyped_fields: [],
			dependencies: lists.dependencies,
		};
	}
}
