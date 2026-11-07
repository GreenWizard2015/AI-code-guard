import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { CACHE_DIRECTORY, LINT_EXECUTION_CACHE_DIRECTORY, LINT_EXECUTION_CACHE_FILE } from "src/core/constants";
import { CachePublicationConcurrentWriterFileIO } from "tests/bridge/ts/core/cache/cache_publication_concurrent_writer_file_io";
import { CachePublicationFaultFileIO } from "tests/bridge/ts/core/cache/cache_publication_fault_file_io";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CachePublicationFaultSchedule } from "tests/bridge/ts/core/cache/types";
import type { CachePublicationFaultCase } from "tests/bridge/ts/core/cache/types";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("complete cache publication and cleanup", () => {
	const fault_schedules: readonly CachePublicationFaultCase[] = [
		{
			title: "write fails after the temporary file exists",
			schedule: CachePublicationFaultSchedule.WriteAfterTempCreated,
		},
		{ title: "temporary rename fails", schedule: CachePublicationFaultSchedule.RenameTemp },
	];

	test.each(fault_schedules)("cleans temporary files and rethrows the original error: $title", async ({ schedule }) => {
		const failure = new Error(`injected complete-cache ${schedule} failure`);
		const file_io = new CachePublicationFaultFileIO({ schedule, failure });
		const fixture = new CompleteCacheFixture(file_io);
		const cache_context = new LintExecutionCacheContext({
			...fixture.cache_context_options(new Map(), fixture._analysis_identity),
			file_io,
		});
		const cache = cache_context.lint_cache();
		const cache_directory = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
		);

		await expect(Promise.resolve().then(() => cache.write({ files: [fixture._file], violations: [] }))).rejects.toBe(
			failure,
		);
		expect({ temporary_files: file_io.temporary_files(cache_directory) }).toEqual({ temporary_files: [] });
	});

	test("preserves the publication error if temporary cleanup also fails", async () => {
		const failure = new Error("injected complete-cache write failure");
		const file_io = new CachePublicationFaultFileIO({
			schedule: CachePublicationFaultSchedule.WriteAfterTempCreatedCleanupFails,
			failure,
		});
		const fixture = new CompleteCacheFixture(file_io);
		const cache_context = new LintExecutionCacheContext({
			...fixture.cache_context_options(new Map(), fixture._analysis_identity),
			file_io,
		});
		const cache = cache_context.lint_cache();
		const cache_directory = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
		);

		const observed = Promise.resolve()
			.then(() => cache.write({ files: [fixture._file], violations: [] }))
			.then(
				() => false,
				(error) => error === failure,
			)
			.then((failure_identity_preserved) => {
				const cleanup_attempts_before_reaping = file_io.cleanup_attempts();
				const temporary_files_before_reaping = file_io.temporary_files(cache_directory);
				const cached_result = cache.cached_result();
				return {
					failure_identity_preserved,
					cleanup_attempts_before_reaping,
					cleanup_attempts_after_reaping: file_io.cleanup_attempts(),
					temporary_files_before_reaping: temporary_files_before_reaping.length,
					cache_available_after_reaping: cached_result.available,
					temporary_files_after_reaping: file_io.temporary_files(cache_directory),
				};
			});
		const result = await observed;
		expect(result).toEqual({
			failure_identity_preserved: true,
			cleanup_attempts_before_reaping: 1,
			cleanup_attempts_after_reaping: 2,
			temporary_files_before_reaping: 1,
			cache_available_after_reaping: false,
			temporary_files_after_reaping: [],
		});
	});

	test("reclaims an abandoned temporary record on read", () => {
		const file_io = new CachePublicationConcurrentWriterFileIO();
		const fixture = new CompleteCacheFixture(file_io);
		const cache_context = new LintExecutionCacheContext({
			...fixture.cache_context_options(new Map(), fixture._analysis_identity),
			file_io,
		});
		const cache = cache_context.lint_cache();
		const cache_directory = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
		);
		const abandoned_temporary = join(
			cache_directory,
			`${LINT_EXECUTION_CACHE_FILE}.${process.pid}.00000000-0000-4000-8000-000000000000.tmp`,
		);
		file_io.file(abandoned_temporary).write_text("abandoned temporary record");

		const result = cache.cached_result();

		expect({
			available: result.available,
			temporary_exists: file_io.file(abandoned_temporary).path_exists(),
		}).toEqual({ available: false, temporary_exists: false });
	});

	test("removes an abandoned writer temp and retains a live writer temp", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const cache_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);
		const cache = cache_context.lint_cache();
		const cache_directory = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
		);
		const abandoned_temporary = join(
			cache_directory,
			`${LINT_EXECUTION_CACHE_FILE}.2147483647.00000000-0000-4000-8000-000000000000.tmp`,
		);
		const live_temporary = join(
			cache_directory,
			`${LINT_EXECUTION_CACHE_FILE}.${process.ppid}.00000000-0000-4000-8000-000000000001.tmp`,
		);
		fixture._file_io.file(abandoned_temporary).write_text("abandoned writer");
		fixture._file_io.file(live_temporary).write_text("live writer");

		const result = cache.cached_result();

		expect({
			available: result.available,
			abandoned_exists: fixture._file_io.file(abandoned_temporary).path_exists(),
			live_exists: fixture._file_io.file(live_temporary).path_exists(),
		}).toEqual({ available: false, abandoned_exists: false, live_exists: true });
	});

	test("keeps both reentrant writers' records isolated during temporary cleanup", () => {
		const file_io = new CachePublicationConcurrentWriterFileIO();
		const fixture = new CompleteCacheFixture(file_io);
		const cache_options = fixture.cache_context_options(new Map(), fixture._analysis_identity);
		const temporary_write_paths = new Set<string>();
		const first_context = new LintExecutionCacheContext({ ...cache_options, file_io, temporary_write_paths });
		const first_cache = first_context.lint_cache();
		const second_context = new LintExecutionCacheContext({ ...cache_options, file_io, temporary_write_paths });
		const second_cache = second_context.lint_cache();
		const cache_directory = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
		);
		file_io.schedule_write(() => second_cache.write({ files: ["nested-writer"], violations: [] }));

		first_cache.write({ files: [fixture._file], violations: [] });
		const nested_write_completed = file_io.completed_write_count() === 1;
		const result = first_cache.cached_result();
		expect({
			nested_write_completed,
			available: result.available,
			files: result.value.files,
			temporary_files: file_io.temporary_files(cache_directory),
		}).toEqual({
			nested_write_completed: true,
			available: true,
			files: [fixture._file],
			temporary_files: [],
		});
	});

	test("cleans only its own temporary file while another writer's temporary file exists", async () => {
		const failure = new Error("injected complete-cache write failure");
		const file_io = new CachePublicationFaultFileIO({
			schedule: CachePublicationFaultSchedule.WriteAfterTempCreatedWithPeer,
			failure,
		});
		const fixture = new CompleteCacheFixture(file_io);
		const cache_context = new LintExecutionCacheContext({
			...fixture.cache_context_options(new Map(), fixture._analysis_identity),
			file_io,
		});
		const cache = cache_context.lint_cache();
		const cache_directory = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
		);

		await expect(Promise.resolve().then(() => cache.write({ files: [fixture._file], violations: [] }))).rejects.toBe(
			failure,
		);
		expect({ temporary_files: file_io.temporary_files(cache_directory) }).toEqual({
			temporary_files: [expect.stringMatching(/\.peer\.tmp$/u)],
		});
	});
});
