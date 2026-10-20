import { ContractFields } from "src/rules/contract_fields";
import { ContractNames } from "src/rules/contract_names";
import type { PythonArchitectureContract } from "src/python_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstClassNode, AstPythonImport } from "src/types";

import type { ArchitectureInput, SimpleViolationGroup } from "src/model/types/types";
import { PYTHON_RULE_IDS } from "src/constants";
import { MODULE_PROTOCOL_KIND } from "src/constants";
import { PYTHON_ABSTRACT_METHOD } from "src/linting/orchestration/runtime/constants";

/** Responsibilities: _contract shape analysis_, _class design diagnostics_. **/
export class PythonArchitecture implements PythonArchitectureContract {
	private readonly empty_contract_rule = PYTHON_RULE_IDS.empty_contract;
	private readonly protocol_kind = MODULE_PROTOCOL_KIND;
	private readonly data_class_rule = PYTHON_RULE_IDS.data_class_method;
	private readonly abstract_class_rule = PYTHON_RULE_IDS.abstract_class;

	/** Responsibilities: _aggregation empty-contract violation class_. **/
	private append_empty_contract(violations: ViolationContract[], file: string, classes: AstClassNode[]): void {
		for (const node of classes) {
			if (!this.empty_protocol(node)) {
				continue;
			}
			this.append_violation(violations, file, node.start + 1, this.empty_contract_rule);
		}
	}

	/** Responsibilities: _aggregation simple architecture violations_. **/
	private append_simple_violations(
		violations: ViolationContract[],
		file: string,
		groups: SimpleViolationGroup[],
	): void {
		for (const group of groups) {
			for (const item of group.items) {
				this.append_violation(violations, file, item.line + 1, group.rule_id);
			}
		}
	}

	/** Responsibilities: _resolution imported ABC names_. **/
	private imported_names(imports: readonly AstPythonImport[], names: readonly string[]): Set<string> {
		const result = new Set(names);
		for (const item of imports) {
			this.append_imported_names(result, item, names);
		}
		return result;
	}

	/** Responsibilities: _abstract import alias registration_. **/
	private append_imported_names(result: Set<string>, item: AstPythonImport, names: readonly string[]): void {
		if (item.module !== "abc") {
			return;
		}
		for (const imported of item.names) {
			if (!names.includes(imported.name)) {
				continue;
			}
			if (imported.alias.length === 0) {
				continue;
			}
			result.add(imported.alias);
		}
	}

	/** Responsibilities: _classification abstract class bases_. **/
	private abstract_base(node: AstClassNode, names: ReadonlySet<string>): boolean {
		for (const base_name of node.base_class_names) {
			const separator = base_name.lastIndexOf(".");
			let name = base_name;
			if (separator >= 0) {
				name = base_name.slice(separator + 1);
			}
			if (names.has(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _classification abstract method decorators_. **/
	private abstract_method(node: AstClassNode, names: ReadonlySet<string>): boolean {
		for (const method of node.methods) {
			for (const decorator of method.decorators) {
				if (names.has(decorator)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _classification abstract Python classes_. **/
	private abstract_class(node: AstClassNode, imports: readonly AstPythonImport[]): boolean {
		const base_names = this.imported_names(imports, ["ABC", "ABCMeta"]);
		if (this.abstract_base(node, base_names)) {
			return true;
		}
		const decorator_names = this.imported_names(imports, [PYTHON_ABSTRACT_METHOD]);
		return this.abstract_method(node, decorator_names);
	}

	/** Responsibilities: _classification allowed data-class methods_. **/
	private allowed_data_method(name: string, decorators: readonly string[]): boolean {
		if (!name.startsWith("__")) {
			return decorators.includes(PYTHON_ABSTRACT_METHOD);
		}
		return name.endsWith("__");
	}

	/** Responsibilities: _aggregation abstract class violations_. **/
	private append_abstract_classes(
		violations: ViolationContract[],
		file: string,
		classes: readonly AstClassNode[],
		imports: readonly AstPythonImport[],
	): void {
		for (const node of classes) {
			if (!this.abstract_class(node, imports)) {
				continue;
			}
			this.append_violation(violations, file, node.start + 1, this.abstract_class_rule);
		}
	}

	/** Responsibilities: _aggregation data-class method violations_. **/
	private append_class_methods(violations: ViolationContract[], file: string, classes: readonly AstClassNode[]): void {
		for (const node of classes) {
			if (!node.is_data_class) {
				continue;
			}
			for (const method of node.methods) {
				if (this.allowed_data_method(method.name, method.decorators)) {
					continue;
				}
				this.append_violation(violations, file, method.start + 1, this.data_class_rule);
			}
		}
	}

	/** Responsibilities: _aggregation Python architecture diagnostic_. **/
	private append_violation(violations: ViolationContract[], file: string, line: number, rule_id: string): void {
		const rule = new DiagnosticRule(rule_id);
		const violation = rule.violation(file, line);
		violations.push(violation);
	}

	/** Responsibilities: _reporting protocol class_. **/
	public empty_protocol(node: AstClassNode): boolean {
		if (!node.protocol) {
			return false;
		}
		if (node.methods.length > 0) {
			return false;
		}
		const field_count = node.fields?.length;
		return field_count !== undefined && field_count === 0;
	}

	/** Responsibilities: _aggregation architecture violations Python_. **/
	public append_architecture_violations(input: ArchitectureInput): void {
		const { violations, file, accesses, branches, classes, imports } = input;
		const contract_fields = new ContractFields();
		const contract_names = new ContractNames();

		contract_names.append(violations, file, classes);
		this.append_empty_contract(violations, file, classes);
		contract_fields.append_contract_fields(violations, file, classes, this.protocol_kind);
		this.append_abstract_classes(violations, file, classes, imports);
		this.append_class_methods(violations, file, classes);
		this.append_simple_violations(violations, file, [
			{ items: accesses, rule_id: PYTHON_RULE_IDS.private_member },
			{ items: branches, rule_id: PYTHON_RULE_IDS.branch_duplication },
		]);
	}
}
