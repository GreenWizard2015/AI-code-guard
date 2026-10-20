import type { ProjectSourceIOContract } from "src/source_protocols";
import { resolve } from "node:path";
import { ProjectPathRelation } from "src/core/support/project_path_relation";

/** Responsibilities: _source snapshot membership_, _source text retrieval_. **/
export class InMemoryProjectSourceIO implements ProjectSourceIOContract {
	private readonly source_texts: ReadonlyMap<string, string>;

	/** Responsibilities: _source inventory eligibility_. **/
	private included_source(root: string, file: string, ignored_directories: ReadonlySet<string>): boolean {
		const relation = new ProjectPathRelation(root, file);
		if (!relation.inside) {
			return false;
		}
		return !relation.contains_any_directory(ignored_directories);
	}

	/** Responsibilities: _source snapshot ownership_. **/
	public constructor(source_texts: ReadonlyMap<string, string>) {
		this.source_texts = source_texts;
	}

	/** Responsibilities: _source snapshot membership_. **/
	public source_available(file: string): boolean {
		return this.source_texts.has(resolve(file));
	}

	/** Responsibilities: _source path inventory_. **/
	public source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[] {
		const paths: string[] = [];
		let absolute_root = "";
		if (root.length > 0) {
			absolute_root = resolve(root);
		}
		for (const path of this.source_texts.keys()) {
			if (root.length > 0) {
				if (!this.included_source(absolute_root, path, ignored_directories)) {
					continue;
				}
			}
			paths.push(path);
		}
		return paths;
	}

	/** Responsibilities: _source text retrieval_. **/
	public source_text(file: string): string {
		const text = this.source_texts.get(resolve(file));
		if (text === undefined) {
			return "";
		}
		return text;
	}
}
