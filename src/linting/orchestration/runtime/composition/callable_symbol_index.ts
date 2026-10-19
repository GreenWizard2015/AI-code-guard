import type { CallableProjectIndex } from "src/metrics/types";
import type { AstTypeMemberRecord } from "src/types";
import type { CallableSymbolIndexContract } from "src/protocols";

/** Responsibilities: _source-qualified symbol resolution_, _type member lookup_. **/
export class CallableSymbolIndex implements CallableSymbolIndexContract {
	private readonly project_types: CallableProjectIndex;

	/** Responsibilities: _source-identified symbol index binding_. **/
	public constructor(project_types: CallableProjectIndex) {
		this.project_types = project_types;
	}

	/** Responsibilities: _source-identified type lookup_. **/
	public types_named(name: string, source_file = ""): AstTypeMemberRecord[] {
		if (source_file.length === 0) {
			return [];
		}
		const members = this.project_types.get(`${source_file}::${name}`);
		if (members === undefined) {
			return [];
		}
		return [members];
	}

	/** Responsibilities: _type member value lookup_. **/
	public type_members(type_name: string, source_file = ""): string[] {
		const result: string[] = [];
		for (const members of this.types_named(type_name, source_file)) {
			result.push(...members.values());
		}
		return result;
	}

	/** Responsibilities: _type member name lookup_. **/
	public type_member_names(type_name: string, source_file = ""): ReadonlySet<string> {
		const names = new Set<string>();
		for (const members of this.types_named(type_name, source_file)) {
			for (const name of members.keys()) {
				names.add(name);
			}
		}
		return names;
	}
}
