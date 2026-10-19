import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ProjectPathRelationContract } from "src/protocols";

/** Responsibilities: _rooted path classification_, _directory segment lookup_. **/
export class ProjectPathRelation implements ProjectPathRelationContract {
	public readonly relative_path: string;
	public readonly inside: boolean;
	public readonly directory_segments: ReadonlySet<string>;
	public readonly first_segment: string;

	/** Responsibilities: _rooted path classification_. **/
	public constructor(root: string, candidate: string) {
		const relative_path = relative(resolve(root), resolve(candidate));
		const parent_path = `..${sep}`;
		this.relative_path = relative_path;
		let inside = true;
		if (isAbsolute(relative_path)) {
			inside = false;
		}
		if (relative_path === "..") {
			inside = false;
		}
		if (relative_path.startsWith(parent_path)) {
			inside = false;
		}
		this.inside = inside;
		this.directory_segments = new Set(relative_path.split(/[\\/]/));
		this.first_segment = relative_path.replace(/[\\/].*$/u, "");
	}

	/** Responsibilities: _strict descendant classification_. **/
	public strictly_nested(): boolean {
		return this.inside && this.relative_path.length !== 0;
	}

	/** Responsibilities: _ignored directory matching_. **/
	public contains_any_directory(names: ReadonlySet<string>): boolean {
		for (const name of names) {
			if (this.directory_segments.has(name)) {
				return true;
			}
		}
		return false;
	}
}
