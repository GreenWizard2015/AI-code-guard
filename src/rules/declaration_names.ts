import { MODULE_INTERFACE_KIND, MODULE_PROTOCOL_KIND, PROTOCOL_NAME_PREFIX } from "src/constants";
import { CONTRACT_SUFFIX } from "src/metrics/constants";
import type { AstClassNode, NamedLine } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _declaration naming_, _contract name validation_. **/
export class DeclarationNames {
	private readonly _file: string;
	private readonly _classes: readonly AstClassNode[];
	private readonly _type_declarations: readonly NamedLine[];
	private readonly _suffix: string;
	private readonly _forbidden_name_parts: readonly string[];
	private readonly _rule: RuleContract;

	/** Responsibilities: _interface and protocol classification_. **/
	private contract_declaration(node: AstClassNode): boolean {
		if (node.classification.protocol) {
			return true;
		}
		if (this._file.endsWith(".py")) {
			return false;
		}
		return node.classification.type_contract;
	}

	/** Responsibilities: _class declaration names_. **/
	private append_class_violations(violations: ViolationContract[]): void {
		for (const node of this._classes) {
			if (this.allowed_name(node.identity.name, this.contract_declaration(node))) {
				continue;
			}
			violations.push(this._rule.violation(this._file, node.identity.start + 1, {}));
		}
	}

	/** Responsibilities: _name rule setup_. **/
	public constructor(file: string, classes: readonly AstClassNode[], type_declarations: readonly NamedLine[] = []) {
		this._file = file;
		this._classes = classes;
		this._type_declarations = type_declarations;
		this._suffix = CONTRACT_SUFFIX;
		this._forbidden_name_parts = [PROTOCOL_NAME_PREFIX, MODULE_PROTOCOL_KIND, MODULE_INTERFACE_KIND];
		this._rule = new DiagnosticRule("contract-naming");
	}

	/** Responsibilities: _declaration naming policy_. **/
	public allowed_name(name: string, contract_declaration: boolean): boolean {
		const normalized_name = name.toLowerCase();
		const has_contract = normalized_name.includes(this._suffix.toLowerCase());
		const has_forbidden_term = this._forbidden_name_parts.some((part) => normalized_name.includes(part));
		if (contract_declaration) {
			const prefix = normalized_name.slice(0, -this._suffix.length);
			if (!name.endsWith(this._suffix)) {
				return false;
			}
			if (prefix.includes(this._suffix.toLowerCase())) {
				return false;
			}
			return !has_forbidden_term;
		}
		return !has_contract && !has_forbidden_term;
	}

	/** Responsibilities: _declaration name validation_. **/
	public append(violations: ViolationContract[]): void {
		this.append_class_violations(violations);
		const class_names = new Set(this._classes.map((node) => node.identity.name));
		for (const declaration of this._type_declarations) {
			if (class_names.has(declaration.name) || this.allowed_name(declaration.name, false)) {
				continue;
			}
			violations.push(this._rule.violation(this._file, declaration.line + 1, {}));
		}
	}
}
