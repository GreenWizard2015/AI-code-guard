import { PYTHON_ABSTRACT_METHOD } from "src/constants";
import { PYTHON_RULE_IDS } from "src/linting/constants";
import type { AstClassNode, AstPythonImport } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ArchitectureInput, SimpleViolationGroup, StructuralDeclarationKind } from "src/model_types";
import type { PythonArchitectureContract } from "src/python_protocols";
import { DeclarationNames } from "src/rules/declaration_names";
import { StructuralFieldRules } from "src/rules/structural_field_rules";

/** Responsibilities: _contract shape analysis_, _class design diagnostics_. **/
export class PythonArchitecture implements PythonArchitectureContract {
	private readonly _empty_contract_rule: string;
	private readonly _protocol_kind: StructuralDeclarationKind;
	private readonly _data_class_rule: string;
	private readonly _abstract_class_rule: string;

	/** Responsibilities: _aggregation empty-contract violation class_. **/
	private append_empty_contract(contract_input: ArchitectureInput): void {
		for (const node of contract_input.classes) {
			if (!this.empty_protocol(node)) {
				continue;
			}
			this.append_violation(contract_input, node.identity.start + 1, this._empty_contract_rule);
		}
	}

	/** Responsibilities: _aggregation simple architecture violations_. **/
	private append_simple_violations(violation_input: ArchitectureInput, groups: SimpleViolationGroup[]): void {
		for (const group of groups) {
			for (const item of group.items) {
				this.append_violation(violation_input, item.line + 1, group.rule_id);
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
	private abstract_base(candidate_class: AstClassNode, base_names: ReadonlySet<string>): boolean {
		for (const base_name of candidate_class.structure.base_class_names) {
			const separator = base_name.lastIndexOf(".");
			let name = base_name;
			if (separator >= 0) {
				name = base_name.slice(separator + 1);
			}
			if (base_names.has(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _classification abstract method decorators_. **/
	private abstract_method(method_owner: AstClassNode, decorator_names: ReadonlySet<string>): boolean {
		for (const method of method_owner.structure.methods) {
			for (const decorator of method.declaration.decorators) {
				if (decorator_names.has(decorator)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _classification abstract Python classes_. **/
	private abstract_class(class_declaration: AstClassNode, imports: readonly AstPythonImport[]): boolean {
		const base_names = this.imported_names(imports, ["ABC", "ABCMeta"]);
		if (this.abstract_base(class_declaration, base_names)) {
			return true;
		}
		const decorator_names = this.imported_names(imports, [PYTHON_ABSTRACT_METHOD]);
		return this.abstract_method(class_declaration, decorator_names);
	}

	/** Responsibilities: _classification allowed data-class methods_. **/
	private allowed_data_method(name: string, decorators: readonly string[]): boolean {
		if (!name.startsWith("__")) {
			return decorators.includes(PYTHON_ABSTRACT_METHOD);
		}
		return name.endsWith("__");
	}

	/** Responsibilities: _aggregation abstract class violations_. **/
	private append_abstract_classes(abstract_input: ArchitectureInput): void {
		for (const node of abstract_input.classes) {
			if (!this.abstract_class(node, abstract_input.imports)) {
				continue;
			}
			this.append_violation(abstract_input, node.identity.start + 1, this._abstract_class_rule);
		}
	}

	/** Responsibilities: _aggregation data-class method violations_. **/
	private append_class_methods(method_input: ArchitectureInput): void {
		for (const node of method_input.classes) {
			if (!node.classification.is_data_class) {
				continue;
			}
			for (const method of node.structure.methods) {
				if (this.allowed_data_method(method.identity.name, method.declaration.decorators)) {
					continue;
				}
				this.append_violation(method_input, method.identity.start + 1, this._data_class_rule);
			}
		}
	}

	/** Responsibilities: _aggregation Python architecture diagnostic_. **/
	private append_violation(diagnostic_input: ArchitectureInput, line: number, rule_id: string): void {
		const rule = new DiagnosticRule(rule_id);
		const violation = rule.violation(diagnostic_input.file, line);
		diagnostic_input.violations.push(violation);
	}

	/** Responsibilities: _Python architecture rule state_. **/
	/** Responsibilities: _Python architecture rule state_. **/
	public constructor(
		empty_contract_rule: string,
		protocol_kind: StructuralDeclarationKind,
		data_class_rule: string,
		abstract_class_rule: string,
	) {
		this._empty_contract_rule = empty_contract_rule;
		this._protocol_kind = protocol_kind;
		this._data_class_rule = data_class_rule;
		this._abstract_class_rule = abstract_class_rule;
	}

	/** Responsibilities: _reporting protocol class_. **/
	public empty_protocol(protocol_candidate: AstClassNode): boolean {
		if (!protocol_candidate.classification.protocol) {
			return false;
		}
		if (protocol_candidate.structure.methods.length > 0) {
			return false;
		}
		const field_count = protocol_candidate.field_analysis.fields?.length;
		return field_count !== undefined && field_count === 0;
	}

	/** Responsibilities: _aggregation architecture violations Python_. **/
	public append_architecture_violations(architecture_input: ArchitectureInput): void {
		const { violations, file, accesses, branches, classes } = architecture_input;
		const contract_fields = new StructuralFieldRules(file, classes, this._protocol_kind);
		const contract_names = new DeclarationNames(file, classes, architecture_input.type_declarations);

		contract_names.append(violations);
		this.append_empty_contract(architecture_input);
		contract_fields.append_contract_fields(violations);
		this.append_abstract_classes(architecture_input);
		this.append_class_methods(architecture_input);
		this.append_simple_violations(architecture_input, [
			{ items: accesses, rule_id: PYTHON_RULE_IDS.private_member },
			{ items: branches, rule_id: PYTHON_RULE_IDS.branch_duplication },
		]);
	}
}
