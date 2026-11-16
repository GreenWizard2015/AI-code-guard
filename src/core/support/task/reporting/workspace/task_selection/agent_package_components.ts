import type { AgentPackageComponentsContract } from "src/task_selection_types";

/** Responsibilities: _file equivalence_, _component membership_. **/
export class AgentPackageComponents implements AgentPackageComponentsContract {
	private readonly _parents: Map<string, string>;

	/** Responsibilities: _component root compression_. **/
	private root(candidate_path: string): string {
		const current = this._parents.get(candidate_path);
		if (current === undefined || current === candidate_path) {
			return candidate_path;
		}
		const root = this.root(current);
		this._parents.set(candidate_path, root);
		return root;
	}

	/** Responsibilities: _component index initialization_. **/
	public constructor() {
		this._parents = new Map();
	}

	/** Responsibilities: _linked file inclusion_. **/
	public link(left: string, right: string): void {
		this.component(left);
		this.component(right);
		const left_root = this.root(left);
		const right_root = this.root(right);
		if (left_root !== right_root) {
			this._parents.set(right_root, left_root);
		}
	}

	/** Responsibilities: _component root access_. **/
	public component(file: string): string {
		if (!this._parents.has(file)) {
			this._parents.set(file, file);
		}
		return this.root(file);
	}

	/** Responsibilities: _file group materialization_. **/
	public groups(): Map<string, string[]> {
		const files_by_root = new Map<string, string[]>();
		for (const file of this._parents.keys()) {
			const root = this.root(file);
			let files = files_by_root.get(root);
			if (files === undefined) {
				files = [];
				files_by_root.set(root, files);
			}
			files.push(file);
		}
		return files_by_root;
	}
}
