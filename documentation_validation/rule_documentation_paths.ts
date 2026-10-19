import { join } from "node:path";
import { RULE_DOCUMENT_DIRECTORY, RULE_DOCUMENT_SUFFIX } from "documentation_validation/constants";
import { RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";
import type {
	RuleDocumentationPathInventory,
	RuleDocumentPath,
	RuleDocumentPresence,
} from "documentation_validation/types";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _canonical rule-document paths_, _documentation inventory_. **/
export class RuleDocumentationPaths {
	private readonly root: string;
	private readonly rule_ids: readonly string[];
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _rule-document path map_. **/
	private registered_paths(): Map<string, string> {
		const paths = new Map(
			this.rule_ids.flatMap((rule_id) => this.rule_file_paths(rule_id).map((path) => [path, rule_id] as const)),
		);
		const expected_count = this.rule_ids.reduce((count, rule_id) => count + this.rule_file_paths(rule_id).length, 0);
		if (paths.size !== expected_count) {
			throw new Error("Multiple registered rules resolve to the same Markdown document path.");
		}
		return paths;
	}

	/** Responsibilities: _unregistered document path identification_. **/
	private invalid_entries(entries: readonly string[], registered_paths: ReadonlyMap<string, string>): string[] {
		return entries.filter((path) => {
			if (!path.endsWith(RULE_DOCUMENT_SUFFIX)) {
				return true;
			}
			return !registered_paths.has(join(RULE_DOCUMENT_DIRECTORY, path));
		});
	}

	/** Responsibilities: _rule-document presence_. **/
	private missing_paths(
		registered_paths: ReadonlyMap<string, string>,
		entries: readonly string[],
	): RuleDocumentPresence {
		const present_paths = new Set(entries.map((path) => join(RULE_DOCUMENT_DIRECTORY, path)));
		const present_documents: RuleDocumentPath[] = [];
		const missing_documents: string[] = [];
		for (const [path, rule_id] of registered_paths) {
			if (present_paths.has(path)) {
				present_documents.push({ rule_id, file_path: path });
			} else {
				missing_documents.push(path);
			}
		}
		return { present_documents, missing_documents };
	}

	/** Responsibilities: _rule path catalog setup_. **/
	public constructor(root: string, rule_ids: readonly string[], source_io: ProjectSourceIOContract) {
		this.root = root;
		this.rule_ids = rule_ids;
		this.source_io = source_io;
	}

	/** Responsibilities: _rule file path lookup_. **/
	public rule_file_paths(rule_id: string): readonly string[] {
		const paths = RULE_DOCUMENT_PATHS_BY_ID.get(rule_id);
		if (paths !== undefined) {
			return paths;
		}
		return [join(RULE_DOCUMENT_DIRECTORY, `${rule_id}${RULE_DOCUMENT_SUFFIX}`)];
	}

	/** Responsibilities: _primary rule-document path_. **/
	public primary_path(rule_id: string): string {
		for (const path of this.rule_file_paths(rule_id)) {
			return path;
		}
		throw new Error(`Rule "${rule_id}" has no registered documentation path.`);
	}

	/** Responsibilities: _registry-document consistency report_. **/
	public scan(): RuleDocumentationPathInventory {
		const directory = join(this.root, RULE_DOCUMENT_DIRECTORY);
		const registered_paths = this.registered_paths();
		const entries = this.source_io
			.source_paths(directory, new Set<string>())
			.map((path) => path.slice(directory.length + 1).replaceAll("\\", "/"));
		const { present_documents, missing_documents } = this.missing_paths(registered_paths, entries);
		const invalid_entries = this.invalid_entries(entries, registered_paths);
		return {
			present_documents,
			registered_rule_ids: new Set(this.rule_ids),
			invalid_entries,
			missing_documents,
		};
	}
}
