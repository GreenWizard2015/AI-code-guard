import type { AstCacheEntryContract } from "src/source_protocols";
import type {
	AstCallableNodeContract,
	AstClassField,
	AstClassNode,
	AstLanguage,
	NamedLine,
	NormalizedAstFile,
} from "src/types";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _cached AST ownership_, _cached language matching_. **/
export class AstCacheHit implements AstCacheEntryContract {
	private readonly cached_ast: NormalizedAstFile;

	/** Responsibilities: _cached callable validation_. **/
	private callable(value: AstCallableNodeContract): boolean {
		if (value === null) {
			return false;
		}
		if (String(value.name) !== value.name) {
			return false;
		}
		if (this.cached_ast.language === TYPESCRIPT_LANGUAGE && String(value.owner) !== value.owner) {
			return false;
		}
		if (!Number.isFinite(value.start) || !Number.isFinite(value.end)) {
			return false;
		}
		const arrays = [value.statements, value.typed_arguments, value.argument_uses, value.parameter_types];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cached field validation_. **/
	private field(value: AstClassField): boolean {
		if (value === null) {
			return false;
		}
		if (String(value.name) !== value.name) {
			return false;
		}
		if (typeof value.readonly !== "boolean") {
			return false;
		}
		return Number.isFinite(value.line);
	}

	/** Responsibilities: _cached named declaration validation_. **/
	private named_line(value: NamedLine): boolean {
		if (value === null) {
			return false;
		}
		if (String(value.name) !== value.name) {
			return false;
		}
		return Number.isFinite(value.line);
	}

	/** Responsibilities: _cached class declaration validation_. **/
	private class_node(value: AstClassNode): boolean {
		if (value === null) {
			return false;
		}
		if (String(value.name) !== value.name) {
			return false;
		}
		if (!Number.isFinite(value.start) || !Number.isFinite(value.end)) {
			return false;
		}
		if (!Array.isArray(value.methods) || !Array.isArray(value.fields)) {
			return false;
		}
		if (!value.methods.every((method) => this.callable(method))) {
			return false;
		}
		return value.fields.every((field) => this.field(field));
	}

	/** Responsibilities: _cached type-member validation_. **/
	private type_members_valid(): boolean {
		for (const [name, members] of this.cached_ast.type_members) {
			if (String(name) !== name) {
				return false;
			}
			for (const [member_name, member_type] of members) {
				if (String(member_name) !== member_name || String(member_type) !== member_type) {
					return false;
				}
			}
		}
		return true;
	}

	/** Responsibilities: _cached declaration validation_. **/
	private declarations_valid(): boolean {
		if (!this.cached_ast.classes.every((value) => this.class_node(value))) {
			return false;
		}
		return this.cached_ast.functions.every((value) => this.callable(value));
	}

	/** Responsibilities: _cached nested data validation_. **/
	private nested_data_valid(): boolean {
		if (!this.type_members_valid()) {
			return false;
		}
		if (!this.cached_ast.type_declarations.every((value) => this.named_line(value))) {
			return false;
		}
		return this.declarations_valid();
	}

	/** Responsibilities: _cache identity shape_. **/
	private identity_arrays(): boolean {
		const arrays = [
			this.cached_ast.classes,
			this.cached_ast.functions,
			this.cached_ast.parse_issues,
			this.cached_ast.import_issues,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cache data shape_. **/
	private data_arrays(): boolean {
		const arrays = [
			this.cached_ast.attribute_accesses,
			this.cached_ast.symbol_references,
			this.cached_ast.literal_references,
			this.cached_ast.literal_constants,
			this.cached_ast.named_symbols,
			this.cached_ast.type_declarations,
			this.cached_ast.reference_aliases,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cache optional data shape_. **/
	private optional_data_arrays(): boolean {
		const arrays = [
			this.cached_ast.private_accesses,
			this.cached_ast.repeated_branches,
			this.cached_ast.call_references,
			this.cached_ast.module_instances,
			this.cached_ast.module_constant_spans,
			this.cached_ast.module_type_spans,
			this.cached_ast.module_protocol_spans,
			this.cached_ast.coding_issues,
			this.cached_ast.python_imports,
			this.cached_ast.docstring_spans,
			this.cached_ast.responsibility_targets,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cached AST state initialization_. **/
	public constructor(ast: NormalizedAstFile) {
		this.cached_ast = ast;
	}

	/** Responsibilities: _cached AST presence reporting_. **/
	public present(): boolean {
		return true;
	}

	/** Responsibilities: _cached AST value_. **/
	public value(): NormalizedAstFile {
		if (!this.complete()) {
			throw new Error("AST cache entry is invalid.");
		}
		return this.cached_ast;
	}

	/** Responsibilities: _cache shape_. **/
	public complete(): boolean {
		if (this.cached_ast.language !== PYTHON_LANGUAGE && this.cached_ast.language !== TYPESCRIPT_LANGUAGE) {
			return false;
		}
		if (!this.identity_arrays()) {
			return false;
		}
		if (!this.data_arrays()) {
			return false;
		}
		if (!this.optional_data_arrays()) {
			return false;
		}
		return this.nested_data_valid();
	}

	/** Responsibilities: _cached AST reuse decision_. **/
	public should_reparse(): boolean {
		return false;
	}

	/** Responsibilities: _cached AST language matching_. **/
	public supports_language(language: AstLanguage): boolean {
		return this.cached_ast.language === language;
	}
}
