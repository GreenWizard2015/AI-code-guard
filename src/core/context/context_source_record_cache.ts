import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { AstDiskCacheContract, ContextSourceRecordCacheContract, LintStageTimerContract } from "src/protocols";
import type { LintSourceRecord, NormalizedAstFile } from "src/types";

/** Responsibilities: _TypeScript AST retrieval_, _persistent AST cache lifecycle_. **/
export class ContextSourceRecordCache implements ContextSourceRecordCacheContract {
	private readonly disk_cache: AstDiskCacheContract;
	private readonly enabled: boolean;

	/** Responsibilities: _cache construction_. **/
	public constructor(disk_cache: AstDiskCacheContract, enabled: boolean) {
		this.disk_cache = disk_cache;
		this.enabled = enabled;
	}

	/** Responsibilities: _stale cache removal_. **/
	public clean(): void {
		if (this.enabled) {
			this.disk_cache.clean_unused_records();
		}
	}

	/** Responsibilities: _TypeScript AST cache_. **/
	public cached_asts(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimerContract,
	): Map<string, NormalizedAstFile> {
		const cached = new Map<string, NormalizedAstFile>();
		if (!this.enabled) {
			return cached;
		}
		return stage_timer.measure("startup.project-context.typescript-ast-disk-cache-read", () => {
			for (const file of files) {
				const text = texts.get(file);
				let source_text = "";
				if (text !== undefined) {
					source_text = text;
				}
				const entry = this.disk_cache.content(file, source_text);
				if (entry.should_reparse()) {
					continue;
				}
				if (!entry.supports_language(TYPESCRIPT_LANGUAGE)) {
					continue;
				}
				cached.set(file, entry.value());
			}
			return cached;
		});
	}

	/** Responsibilities: _TypeScript AST persistence_. **/
	public write(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		records: readonly LintSourceRecord[],
		cached: ReadonlyMap<string, NormalizedAstFile>,
		stage_timer: LintStageTimerContract,
	): LintSourceRecord[] {
		if (!this.enabled) {
			return [...records];
		}
		return stage_timer.measure("startup.project-context.typescript-ast-disk-cache-write", () => {
			for (const [index, file] of files.entries()) {
				if (cached.has(file)) {
					continue;
				}
				const record = records[index];
				if (record !== undefined) {
					const text = texts.get(file);
					let source_text = "";
					if (text !== undefined) {
						source_text = text;
					}
					this.disk_cache.write(file, source_text, record.normalized_ast);
				}
			}
			return [...records];
		});
	}
}
