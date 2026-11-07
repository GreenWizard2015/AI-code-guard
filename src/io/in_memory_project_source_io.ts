import { resolve } from "node:path";
import { ProjectPathRelation } from "src/core/support/project_path_relation";
import type { ProjectPathRelationContract } from "src/core/support/protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _source snapshot membership_, _source text retrieval_. **/
export class InMemoryProjectSourceIO implements ProjectSourceIOContract {
	private readonly _source_texts: ReadonlyMap<string, string>;

	/** Responsibilities: _source path inclusion policy_. **/
	private source_is_included(relation: ProjectPathRelationContract, ignored_directories: ReadonlySet<string>): boolean {
		if (!relation.inside_root()) {
			return false;
		}
		return !relation.contains_any_directory(ignored_directories);
	}

	/** Responsibilities: _source snapshot ownership_. **/
	public constructor(source_texts: ReadonlyMap<string, string>) {
		this._source_texts = source_texts;
	}

	/** Responsibilities: _source snapshot membership_. **/
	public source_available(file: string): boolean {
		return this._source_texts.has(resolve(file));
	}

	/** Responsibilities: _source path inventory_. **/
	public source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[] {
		const paths: string[] = [];
		let absolute_root = "";
		if (root.length > 0) {
			absolute_root = resolve(root);
		}
		for (const path of this._source_texts.keys()) {
			if (root.length > 0) {
				const relation = new ProjectPathRelation(absolute_root, path);
				if (!this.source_is_included(relation, ignored_directories)) {
					continue;
				}
			}
			paths.push(path);
		}
		return paths;
	}

	/** Responsibilities: _source text retrieval_. **/
	public source_text(file: string): string {
		const text = this._source_texts.get(resolve(file));
		if (text === undefined) {
			return "";
		}
		return text;
	}
}
