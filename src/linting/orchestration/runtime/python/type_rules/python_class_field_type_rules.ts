import { PYTHON_LANGUAGE } from "src/constants";
import { PythonMutableCollectionType } from "src/linting/orchestration/runtime/python/type_rules/python_mutable_collection_type";
import type { PythonRuleInput } from "src/linting/types";
import { ProjectTypeBoundary } from "src/metrics/project_type_boundary";
import type { ProjectTypeBoundaryNames } from "src/metrics/types";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _Python field typing_, _project type boundaries_. **/
export class PythonClassFieldTypeRules {
	private readonly _input: PythonRuleInput;
	private readonly _type_field_rule: RuleContract;
	private readonly _field_type_rule: RuleContract;
	private readonly _public_state_rule: RuleContract;
	private readonly _mutable_collection_aliases: ReadonlyMap<string, string>;
	private readonly _project_class_names: ReadonlySet<string>;

	/** Responsibilities: _mutable field classification_. **/
	private mutable_collection_field(type_name: string): boolean {
		const collection_type = new PythonMutableCollectionType(
			type_name,
			this._input.source.python_imports,
			this._mutable_collection_aliases,
		);
		if (collection_type.known_mutable()) {
			return true;
		}
		return collection_type.imported();
	}

	/** Responsibilities: _mutable class field violations_. **/
	private append_mutable_issue(node: AstClassNode): void {
		if (node.classification.is_data_class || node.classification.type_contract || node.classification.protocol) {
			return;
		}
		for (const field of node.field_analysis.fields) {
			if (field.name.startsWith("_")) {
				continue;
			}
			if (!this.mutable_collection_field(field.type)) {
				continue;
			}
			this._input.violations.push(this._public_state_rule.violation(this._input.file_name.value(), field.line + 1, {}));
		}
	}

	/** Responsibilities: _project type contracts_. **/
	private allowed_contracts(classes: readonly AstClassNode[]): Set<string> {
		const declared_contract_names = [...this._input.project.types, ...this._input.project.protocols];
		const allowed_names = declared_contract_names.filter((name) => !this._project_class_names.has(name));
		const allowed = new Set(allowed_names);
		for (const node of classes) {
			if (node.classification.is_data_class) {
				allowed.add(node.identity.name);
			}
		}
		return allowed;
	}

	/** Responsibilities: _project type boundary names_. **/
	private boundary_names(classes: readonly AstClassNode[]): ProjectTypeBoundaryNames {
		const allowed_contracts = this.allowed_contracts(classes);
		const project_class_names = [...this._input.project.classes];
		const forbidden_names = project_class_names.filter((name) => !allowed_contracts.has(name));
		return {
			project_types: this._input.project.types,
			project_class_names: this._input.project.classes,
			allowed_contracts,
			forbidden_project_types: new Set(forbidden_names),
			imported_contract_names: new Set(),
			reference_aliases: this._input.source.reference_aliases,
			language: PYTHON_LANGUAGE,
		};
	}

	/** Responsibilities: _field rule setup_. **/
	public constructor(input: PythonRuleInput) {
		this._input = input;
		this._type_field_rule = new DiagnosticRule("type-field-count");
		this._field_type_rule = new DiagnosticRule("python-explicit-field-type");
		this._public_state_rule = new DiagnosticRule("public-state-exposure");
		this._mutable_collection_aliases = new Map(
			input.source.reference_aliases.map((alias) => [alias.name, alias.target]),
		);
		this._project_class_names = input.project.classes;
	}

	/** Responsibilities: _type contract field-count violations_. **/
	public append_type_fields(): void {
		for (const node of this._input.source.classes) {
			if (node.classification.type_contract !== true && node.classification.protocol !== true) {
				continue;
			}
			const count = node.field_analysis.fields.length;
			if (count > 10) {
				this._input.violations.push(
					this._type_field_rule.violation(this._input.file_name.value(), node.identity.start + 1, {
						count: String(count),
					}),
				);
			}
		}
	}

	/** Responsibilities: _untyped class field violations_. **/
	public append_field_types(): void {
		for (const node of this._input.source.classes) {
			for (const field of node.field_analysis.untyped_fields) {
				this._input.violations.push(
					this._field_type_rule.violation(this._input.file_name.value(), field.line + 1, { name: field.name }),
				);
			}
		}
	}

	/** Responsibilities: _public state violations_. **/
	public append_public_state(): void {
		if (this._input.file_name.test()) {
			return;
		}
		for (const node of this._input.source.classes) {
			this.append_mutable_issue(node);
		}
	}

	/** Responsibilities: _project type boundary violations_. **/
	public append_boundary(): void {
		if (this._input.file_name.test()) {
			return;
		}
		const classes = this._input.source.classes;
		const callables = this._input.operations.callables;
		const boundary = new ProjectTypeBoundary({
			source: {
				violations: this._input.violations,
				file: this._input.file_name.value(),
				callables,
				fields: classes.flatMap((node) => node.field_analysis.fields),
			},
			names: this.boundary_names(classes),
		});
		boundary.append();
	}
}
