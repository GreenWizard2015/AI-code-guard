import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { AstClassNode, AstLanguage, NamedLine } from "src/model/ast/normalized_ast_types";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _source declaration names_, _language-specific name selection_. **/
export class SourceNameCollection {
	private readonly _classes: readonly AstClassNode[];
	private readonly _type_declarations: readonly NamedLine[];
	private readonly _language: AstLanguage;

	/** Responsibilities: _Python implementation class names_. **/
	private python_class_names(): string[] {
		return this._classes
			.filter(
				(class_node) =>
					!class_node.classification.protocol &&
					!class_node.structure.base_class_names.some((name) => ["Enum", "IntEnum", "StrEnum"].includes(name)),
			)
			.map((class_node) => class_node.identity.name);
	}

	/** Responsibilities: _TypeScript implementation class names_. **/
	private typescript_class_names(): string[] {
		const names: string[] = [];
		for (const class_node of this._classes) {
			if (!class_node.classification.type_contract && !class_node.classification.protocol) {
				names.push(class_node.identity.name);
			}
		}
		return names;
	}

	/** Responsibilities: _project type declaration names_. **/
	private project_type_names(): string[] {
		const names = this._classes.map((class_node) => class_node.identity.name);
		for (const declaration of this._type_declarations) {
			names.push(declaration.name);
		}
		return names;
	}

	/** Responsibilities: _source name collection initialization_. **/
	public constructor(source: LintSourceRecordData) {
		this._classes = source.normalized_ast.source.classes;
		this._type_declarations = source.normalized_ast.references.type_declarations;
		this._language = source.language;
	}

	/** Responsibilities: _implementation class names_. **/
	public class_names(): string[] {
		if (this._language === TYPESCRIPT_LANGUAGE) {
			return this.typescript_class_names();
		}
		return this.python_class_names();
	}

	/** Responsibilities: _source type name selection_. **/
	public names(include_type_declarations: boolean): string[] {
		if (include_type_declarations) {
			return this.project_type_names();
		}
		return this.class_names();
	}

	/** Responsibilities: _type declaration names_. **/
	public type_alias_names(): string[] {
		const class_names = new Set(this._classes.map((class_node) => class_node.identity.name));
		return this._type_declarations
			.filter((declaration) => !class_names.has(declaration.name))
			.map((declaration) => declaration.name);
	}

	/** Responsibilities: _protocol declaration names_. **/
	public protocol_names(): string[] {
		const names: string[] = [];
		for (const class_node of this._classes) {
			if (class_node.classification.protocol === true) {
				names.push(class_node.identity.name);
			}
		}
		return names;
	}

	/** Responsibilities: _TypeScript contract names_. **/
	public contract_names(): string[] {
		const names: string[] = [];
		if (this._language !== TYPESCRIPT_LANGUAGE) {
			return names;
		}
		for (const class_node of this._classes) {
			if (class_node.classification.type_contract || class_node.classification.protocol) {
				names.push(class_node.identity.name);
			}
		}
		return names;
	}

	/** Responsibilities: _TypeScript interface names_. **/
	public interface_names(): string[] {
		const names = this._classes
			.filter((class_node) => class_node.classification.type_contract)
			.map((class_node) => class_node.identity.name);
		const class_names = new Set(this._classes.map((class_node) => class_node.identity.name));
		for (const declaration of this._type_declarations) {
			if (!class_names.has(declaration.name)) {
				names.push(declaration.name);
			}
		}
		return names;
	}
}
