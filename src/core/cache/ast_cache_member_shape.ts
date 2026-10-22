import type { AstCacheRecord } from "src/model/types/types";
import type { AstTypeMemberSerialized, AstTypeMemberSerializedGroup } from "src/types";

/** Responsibilities: _cache record shape_, _type-member structure_. **/
export class AstCacheMemberShape {
	private readonly record: AstCacheRecord;

	/** Responsibilities: _cache record setup_. **/
	public constructor(record: AstCacheRecord) {
		this.record = record;
	}

	/** Responsibilities: _cache record integrity_. **/
	public record_valid(): boolean {
		const ast = this.record.ast;
		if (ast === undefined || ast === null || Array.isArray(ast)) {
			return false;
		}
		if (!Array.isArray(ast.type_members)) {
			return false;
		}
		if (!Array.isArray(ast.python_exports)) {
			return false;
		}
		return this.member_groups_valid();
	}

	/** Responsibilities: _member group integrity_. **/
	public member_groups_valid(): boolean {
		const ast = this.record.ast;
		if (ast === undefined || ast === null || Array.isArray(ast)) {
			return false;
		}
		const groups = ast.type_members;
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
		if (group === null) {
			return false;
		}
		if (Array.isArray(group)) {
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
		if (member === null) {
			return false;
		}
		return !Array.isArray(member);
	}
}
