import type { ContextSourceRecordCacheContract } from "src/cache_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { AstDiskCacheContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _TypeScript AST retrieval_, _persistent AST cache lifecycle_. **/
export class ContextSourceRecordCache implements ContextSourceRecordCacheContract {
	private readonly _disk_cache: AstDiskCacheContract;
	private readonly _enabled: boolean;

	/** Responsibilities: _cache construction_. **/
	public constructor(disk_cache: AstDiskCacheContract, enabled: boolean) {
		this._disk_cache = disk_cache;
		this._enabled = enabled;
	}

	/** Responsibilities: _stale cache removal_. **/
	public clean(): void {
		if (this._enabled) {
			this._disk_cache.clean_unused_records();
		}
	}

	/** Responsibilities: _TypeScript AST cache_. **/
	public cached_asts(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		stage_timer: LintStageTimerContract,
	): Map<string, NormalizedAstFile> {
		const cached = new Map<string, NormalizedAstFile>();
		if (!this._enabled) {
			return cached;
		}
		return stage_timer.measure("startup.project-context.typescript-ast-disk-cache-read", () => {
			for (const file of files) {
				const text = texts.get(file);
				let source_text = "";
				if (text !== undefined) {
					source_text = text;
				}
				const entry = this._disk_cache.content(file, source_text);
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
		records: readonly LintSourceRecordData[],
		cached: ReadonlyMap<string, NormalizedAstFile>,
		stage_timer: LintStageTimerContract,
	): LintSourceRecordData[] {
		if (!this._enabled) {
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
					this._disk_cache.write(file, source_text, record.normalized_ast);
				}
			}
			return [...records];
		});
	}
}
