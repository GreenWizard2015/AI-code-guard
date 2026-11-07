import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import type {
	AstCallableIdentity,
	AstCallableNode,
	AstCallableSignature,
	AstClassField,
	AstClassNode,
	AstClassNodeFieldAnalysis,
	AstClassNodeIdentity,
	AstClassNodeStructure,
	AstLanguage,
	NamedLine,
	NormalizedAstSource,
} from "src/model/ast/normalized_ast_types";
import type { CachedAstSourceContract } from "src/source_protocols";

/** Responsibilities: _cached source declaration shape_, _source language identity_. **/
export class CachedAstSource implements CachedAstSourceContract {
	private readonly _source: NormalizedAstSource;

	/** Responsibilities: _cached callable identity validation_. **/
	private callable_identity(identity: AstCallableIdentity): boolean {
		if (identity === null) {
			return false;
		}
		if (typeof identity !== "object") {
			return false;
		}
		if (Array.isArray(identity)) {
			return false;
		}
		if (typeof identity.name !== "string" || typeof identity.owner !== "string") {
			return false;
		}
		return Number.isFinite(identity.start) && Number.isFinite(identity.end);
	}

	/** Responsibilities: _cached callable signature validation_. **/
	private callable_signature(signature: AstCallableSignature): boolean {
		if (signature === null) {
			return false;
		}
		if (typeof signature !== "object") {
			return false;
		}
		if (Array.isArray(signature)) {
			return false;
		}
		if (!Array.isArray(signature.statements) || !Array.isArray(signature.typed_arguments)) {
			return false;
		}
		return Array.isArray(signature.argument_uses) && Array.isArray(signature.parameter_types);
	}

	/** Responsibilities: _cached callable validation_. **/
	private callable(value: AstCallableNode): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (typeof value !== "object") {
			return false;
		}
		if (Array.isArray(value)) {
			return false;
		}
		return this.callable_identity(value.identity) && this.callable_signature(value.signature);
	}

	/** Responsibilities: _cached field validation_. **/
	private field(value: AstClassField): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (typeof value !== "object" || Array.isArray(value)) {
			return false;
		}
		if (
			typeof value.name !== "string" ||
			typeof value.readonly !== "boolean" ||
			typeof value.class_scope !== "boolean"
		) {
			return false;
		}
		return Number.isFinite(value.line);
	}

	/** Responsibilities: _cached class identity fields_. **/
	private class_identity_valid(identity: AstClassNodeIdentity): boolean {
		if (identity === null) {
			return false;
		}
		if (typeof identity !== "object" || Array.isArray(identity)) {
			return false;
		}
		if (typeof identity.name !== "string" || !Number.isFinite(identity.start)) {
			return false;
		}
		return Number.isFinite(identity.end);
	}

	/** Responsibilities: _cached class structure_. **/
	private class_structure_valid(structure: AstClassNodeStructure): boolean {
		if (structure === null || typeof structure !== "object" || Array.isArray(structure)) {
			return false;
		}
		if (!Array.isArray(structure.methods)) {
			return false;
		}
		return structure.methods.every((method) => this.callable(method));
	}

	/** Responsibilities: _cached class field analysis_. **/
	private field_analysis_valid(field_analysis: AstClassNodeFieldAnalysis): boolean {
		if (field_analysis === null || typeof field_analysis !== "object") {
			return false;
		}
		if (Array.isArray(field_analysis)) {
			return false;
		}
		if (!Array.isArray(field_analysis.fields)) {
			return false;
		}
		return field_analysis.fields.every((field) => this.field(field));
	}

	/** Responsibilities: _cached class declaration shape_. **/
	private class_node(value: AstClassNode): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (typeof value !== "object" || Array.isArray(value)) {
			return false;
		}
		if (!this.class_identity_valid(value.identity) || !this.class_structure_valid(value.structure)) {
			return false;
		}
		return this.field_analysis_valid(value.field_analysis);
	}

	/** Responsibilities: _AST source section initialization_. **/
	public constructor(source: NormalizedAstSource) {
		this._source = source;
	}

	/** Responsibilities: _cached named declaration shape_. **/
	public named_line_valid(value: NamedLine): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (typeof value !== "object" || Array.isArray(value)) {
			return false;
		}
		if (typeof value.name !== "string") {
			return false;
		}
		return Number.isFinite(value.line);
	}

	/** Responsibilities: _source declaration array integrity_. **/
	public arrays_valid(): boolean {
		if (!Array.isArray(this._source.classes) || !Array.isArray(this._source.functions)) {
			return false;
		}
		return Array.isArray(this._source.parse_issues) && Array.isArray(this._source.import_issues);
	}

	/** Responsibilities: _cached source declaration validation_, _cached AST language support_. **/
	public declarations_valid(language: AstLanguage): boolean {
		if (language !== PYTHON_LANGUAGE && language !== TYPESCRIPT_LANGUAGE) {
			return false;
		}
		if (!this._source.classes.every((value) => this.class_node(value))) {
			return false;
		}
		return this._source.functions.every((value) => this.callable(value));
	}

	/** Responsibilities: _cached AST language support_. **/
	public supported_language(): boolean {
		return this._source.language === PYTHON_LANGUAGE || this._source.language === TYPESCRIPT_LANGUAGE;
	}
}
