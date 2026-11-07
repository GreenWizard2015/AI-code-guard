import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { PATH_ENV_VARIABLE } from "src/core/constants";
import { ProjectAnalysisFileIdentity } from "src/core/project-source/project_analysis_file_identity";
import type { IOContract } from "src/io/protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _project analysis identity_, _cache invalidation boundaries_. **/
export class ProjectAnalysisIdentity implements ProjectAnalysisIdentityContract {
	private readonly _analyzer_root: string;
	private readonly _analyzer_digests: Map<string, string>;
	private readonly _analysis_files: ProjectAnalysisFileIdentity;
	private readonly _algorithm = "sha256";
	private readonly _separator = "\u0000";
	private readonly _encoding = "hex";

	/** Responsibilities: _source record identity serialization_. **/
	private record_identities(records: readonly LintSourceRecordData[]): string[] {
		const identities: string[] = [];
		for (const record of records) {
			const type_members = Array.from(record.normalized_ast.references.type_members, ([name, members]) => [
				name,
				Array.from(members.entries()),
			]);
			const normalized_ast_value = {
				...record.normalized_ast,
				references: { ...record.normalized_ast.references, type_members },
			};
			const serialized_identity = JSON.stringify([record.absolute_path, record.text, normalized_ast_value]);
			identities.push(createHash(this._algorithm).update(serialized_identity).digest(this._encoding));
		}
		return identities;
	}

	/** Responsibilities: _analysis identity initialization_. **/
	public constructor(file_io: IOContract, analyzer_root = "", runtime_search_path = "") {
		this._analyzer_digests = new Map<string, string>();
		let root = analyzer_root;
		if (root.length === 0) {
			root = REPORTING_PROJECT_ROOT;
		}
		let search_path = runtime_search_path;
		if (search_path.length === 0) {
			const process_path = process.env[PATH_ENV_VARIABLE];
			if (process_path !== undefined) {
				search_path = process_path;
			}
		}
		this._analyzer_root = resolve(root);
		this._analysis_files = new ProjectAnalysisFileIdentity(file_io, this._analyzer_root, this._separator, search_path);
	}

	/** Responsibilities: _source content identity_. **/
	public content(value: string): string {
		return createHash(this._algorithm).update(value).digest(this._encoding);
	}

	/** Responsibilities: _analyzer implementation identity_. **/
	public analyzer(): string {
		const cached_digest = this._analyzer_digests.get(this._analyzer_root);
		if (cached_digest !== undefined) {
			return cached_digest;
		}
		const hash = createHash(this._algorithm);
		this._analysis_files.append_analyzer_identity(hash);
		const digest = hash.digest(this._encoding);
		this._analyzer_digests.set(this._analyzer_root, digest);
		return digest;
	}

	/** Responsibilities: _complete project source identity_. **/
	public context(records: readonly LintSourceRecordData[]): string {
		const record_identities = this.record_identities(records);
		record_identities.sort();
		const hash = createHash(this._algorithm);
		hash.update(this.analyzer());
		hash.update(this._separator);
		let first_identity = true;
		for (const record_identity of record_identities) {
			if (!first_identity) {
				hash.update(this._separator);
			}
			hash.update(record_identity);
			first_identity = false;
		}
		return hash.digest(this._encoding);
	}

	/** Responsibilities: _filesystem-dependent analysis identity_. **/
	public directory_context(root: string): string {
		const hash = createHash(this._algorithm);
		this._analysis_files.append_directory_identity(root, hash);
		return hash.digest(this._encoding);
	}

	/** Responsibilities: _analysis selection identity_. **/
	public selection(
		files: ReadonlySet<string>,
		ignored_files: ReadonlySet<string>,
		entry_files: ReadonlySet<string>,
	): string {
		const sorted_files = [...files];
		sorted_files.sort();
		const sorted_ignored_files = [...ignored_files];
		sorted_ignored_files.sort();
		const sorted_entry_files = [...entry_files];
		sorted_entry_files.sort();
		const value = JSON.stringify([sorted_files, sorted_ignored_files, sorted_entry_files]);
		return createHash(this._algorithm).update(value).digest(this._encoding);
	}
}
