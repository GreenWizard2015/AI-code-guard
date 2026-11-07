import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ProjectNames } from "src/project_analysis_types";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _project name classification_, _project name index aggregation_. **/
export class ASTVerifierTestProjectNames {
	private readonly _classes: readonly AstClassNode[];
	private readonly _declarations: readonly string[];

	/** Responsibilities: _all source class names_. **/
	private class_names(): Set<string> {
		return new Set(this._classes.map((item) => item.identity.name));
	}

	/** Responsibilities: _implementation class name classification_. **/
	private implementation_names(): Set<string> {
		return new Set(
			this._classes
				.filter((item) => !item.classification.type_contract && !item.classification.protocol)
				.map((item) => item.identity.name),
		);
	}

	/** Responsibilities: _protocol name classification_. **/
	private protocol_names(): Set<string> {
		return new Set(this._classes.filter((item) => item.classification.protocol).map((item) => item.identity.name));
	}

	/** Responsibilities: _contract name classification_. **/
	private contract_names(): Set<string> {
		return new Set(
			this._classes
				.filter((item) => item.classification.type_contract || item.classification.protocol)
				.map((item) => item.identity.name),
		);
	}

	/** Responsibilities: _type alias name classification_. **/
	private alias_names(): Set<string> {
		const class_names = this.class_names();
		return new Set(this._declarations.filter((name) => !class_names.has(name)));
	}

	/** Responsibilities: _project type name indexing_. **/
	private project_types(): Set<string> {
		return new Set([...this.class_names(), ...this._declarations]);
	}

	/** Responsibilities: _interface name indexing_. **/
	private interface_names(): Set<string> {
		const type_contract_names = this._classes
			.filter((item) => item.classification.type_contract)
			.map((item) => item.identity.name);
		return new Set([...type_contract_names, ...this._declarations]);
	}

	/** Responsibilities: _source name index setup_. **/
	public constructor(source: LintSourceRecordData) {
		const normalized_ast = source.normalized_ast;
		this._classes = normalized_ast.source.classes;
		this._declarations = normalized_ast.references.type_declarations.map((item) => item.name);
	}

	/** Responsibilities: _project name aggregation_. **/
	public names(): ProjectNames {
		const implementation_names = this.implementation_names();
		const project_types = this.project_types();
		const aliases = this.alias_names();
		return {
			project_class_names: implementation_names,
			python_class_names: new Set(),
			typescript_class_names: implementation_names,
			project_protocol_names: this.protocol_names(),
			project_interface_names: this.interface_names(),
			project_contract_names: this.contract_names(),
			project_type_names: project_types,
			project_alias_names: aliases,
			typescript_type_names: project_types,
			typescript_alias_names: aliases,
		};
	}
}
