import type { AstCacheAst, AstCacheAstModuleMetadata, AstCacheAstReferences } from "src/cache_types";
import type { NormalizedAstControlFlow, NormalizedAstSource } from "src/model/ast/normalized_ast_types";
import type { AstTypeMemberSerialized, AstTypeMemberSerializedGroup } from "src/model/ast/normalized_ast_types";
import type { AstCacheRecord } from "src/model_types";

/** Responsibilities: _cache record shape_, _type member integrity_. **/
export class AstCacheMemberShape {
	private readonly _record: AstCacheRecord;

	/** Responsibilities: _cached AST object shape_. **/
	private ast_object_valid(ast: AstCacheAst): boolean {
		if (ast === undefined) {
			return false;
		}
		if (ast === null) {
			return false;
		}
		return !Array.isArray(ast);
	}

	/** Responsibilities: _source group shape_. **/
	private source_valid(source: NormalizedAstSource): boolean {
		if (source === undefined || source === null || Array.isArray(source)) {
			return false;
		}
		return [
			source.classes,
			source.functions,
			source.parse_issues,
			source.import_issues,
			source.coding_issues,
			source.python_imports,
		].every(Array.isArray);
	}

	/** Responsibilities: _reference section shape_. **/
	private references_valid(references: AstCacheAstReferences): boolean {
		if (references === undefined) {
			return false;
		}
		if (references === null) {
			return false;
		}
		if (Array.isArray(references)) {
			return false;
		}
		const arrays = [
			references.attribute_accesses,
			references.named_symbols,
			references.type_declarations,
			references.symbol_references,
			references.literal_references,
			references.literal_constants,
			references.reference_aliases,
			references.call_references,
			references.type_members,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _control-flow group shape_. **/
	private control_flow_valid(control_flow: NormalizedAstControlFlow): boolean {
		if (control_flow === undefined || control_flow === null || Array.isArray(control_flow)) {
			return false;
		}
		return [control_flow.private_accesses, control_flow.repeated_branches, control_flow.module_instances].every(
			Array.isArray,
		);
	}

	/** Responsibilities: _module declaration shape_. **/
	private module_declarations_valid(declarations: AstCacheAstModuleMetadata): boolean {
		if (declarations === undefined) {
			return false;
		}
		if (declarations === null) {
			return false;
		}
		if (Array.isArray(declarations)) {
			return false;
		}
		const arrays = [
			declarations.module_constant_spans,
			declarations.module_type_spans,
			declarations.module_protocol_spans,
			declarations.responsibility_targets,
			declarations.python_exports,
			declarations.docstring_spans,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cache record setup_. **/
	public constructor(record: AstCacheRecord) {
		this._record = record;
	}

	/** Responsibilities: _cache record integrity_. **/
	public record_valid(): boolean {
		const ast = this._record.ast;
		if (!this.ast_object_valid(ast)) {
			return false;
		}
		if (!this.source_valid(ast.source)) {
			return false;
		}
		if (!this.references_valid(ast.references)) {
			return false;
		}
		if (!this.control_flow_valid(ast.control_flow)) {
			return false;
		}
		if (!this.module_declarations_valid(ast.module_declarations)) {
			return false;
		}
		return this.member_groups_valid();
	}

	/** Responsibilities: _member group integrity_. **/
	public member_groups_valid(): boolean {
		const ast = this._record.ast;
		if (ast === undefined || ast === null || Array.isArray(ast)) {
			return false;
		}
		const groups = ast.references.type_members;
		if (!Array.isArray(groups)) {
			return false;
		}
		for (const group of groups) {
			if (!this.member_group_valid(group)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _member group integrity_. **/
	public member_group_valid(group: AstTypeMemberSerializedGroup): boolean {
		if (group === undefined || group === null) {
			return false;
		}
		if (Array.isArray(group)) {
			return false;
		}
		if (typeof group.name !== "string") {
			return false;
		}
		if (!Array.isArray(group.members)) {
			return false;
		}
		return this.member_records_valid(group.members);
	}

	/** Responsibilities: _member record collection integrity_. **/
	public member_records_valid(members: AstTypeMemberSerialized[]): boolean {
		for (const member of members) {
			if (member === null) {
				return false;
			}
			if (!this.member_valid(member)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _member record integrity_. **/
	public member_valid(member: AstTypeMemberSerialized): boolean {
		if (member === undefined || member === null) {
			return false;
		}
		if (Array.isArray(member)) {
			return false;
		}
		return typeof member.name === "string" && typeof member.type === "string";
	}
}
