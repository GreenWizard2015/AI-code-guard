import { isAbsolute, relative, sep } from "node:path";
import type { ProjectPathRelationContract } from "src/core/support/protocols";

/** Responsibilities: _rooted path classification_, _directory segment lookup_. **/
export class ProjectPathRelation implements ProjectPathRelationContract {
	private readonly _relative_path: string;
	private readonly _inside: boolean;

	/** Responsibilities: _canonical path recognition_. **/
	private canonical_absolute_path(path: string): boolean {
		if (!path.startsWith("/")) {
			return false;
		}
		if (path.includes("//") || path.includes("/./") || path.endsWith("/.")) {
			return false;
		}
		if (path.includes("/../") || path.endsWith("/..")) {
			return false;
		}
		if (path.length > 1 && path.endsWith("/")) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _rooted path classification_. **/
	public constructor(root: string, candidate: string) {
		let relative_path = "";
		let fast_path = false;
		if (sep === "/" && this.canonical_absolute_path(root) && this.canonical_absolute_path(candidate)) {
			if (candidate === root) {
				fast_path = true;
			} else {
				let root_prefix = root;
				if (root !== "/" && !root.endsWith("/")) {
					root_prefix = `${root}/`;
				}
				if (candidate.startsWith(root_prefix)) {
					relative_path = candidate.slice(root_prefix.length);
					fast_path = true;
				}
			}
		}
		if (!fast_path) {
			relative_path = relative(root, candidate);
		}
		const parent_path = `..${sep}`;
		this._relative_path = relative_path;
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
		this._inside = inside;
	}

	/** Responsibilities: _strict descendant classification_. **/
	public strictly_nested(): boolean {
		if (!this._inside) {
			return false;
		}
		return this._relative_path.length > 0;
	}

	/** Responsibilities: _relative path access_. **/
	public path(): string {
		return this._relative_path;
	}

	/** Responsibilities: _path containment access_. **/
	public inside_root(): boolean {
		return this._inside;
	}

	/** Responsibilities: _ignored directory matching_. **/
	public contains_any_directory(names: ReadonlySet<string>): boolean {
		for (const segment of this._relative_path.split(/[\\/]/)) {
			if (names.has(segment)) {
				return true;
			}
		}
		return false;
	}
}
