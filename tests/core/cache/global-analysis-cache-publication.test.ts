import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { ViolationValue } from "src/model/violation_value";
import { CachePublicationConcurrentWriterFileIO } from "tests/bridge/ts/core/cache/cache_publication_concurrent_writer_file_io";
import { CachePublicationFaultFileIO } from "tests/bridge/ts/core/cache/cache_publication_fault_file_io";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CachePublicationFaultSchedule } from "tests/bridge/ts/core/cache/types";
import type { CachePublicationFaultCase } from "tests/bridge/ts/core/cache/types";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("GlobalAnalysisCache publication", () => {
	const fixtures = new CacheFixtureBuilder();
	const fault_schedules: readonly CachePublicationFaultCase[] = [
		{
			title: "write fails after the temporary file exists",
			schedule: CachePublicationFaultSchedule.WriteAfterTempCreated,
		},
		{ title: "temporary rename fails", schedule: CachePublicationFaultSchedule.RenameTemp },
	];

	test.each(fault_schedules)("cleans temporary files and preserves the error: $title", ({ schedule }) => {
		const failure = new Error(`injected global-analysis-cache ${schedule} failure`);
		const file_io = new CachePublicationFaultFileIO({ schedule, failure });
		const fixture = fixtures.create(file_io);
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		expect(() => cache.write([fixture._violation])).toThrow(failure);
		expect(file_io.temporary_files(cache_directory)).toEqual([]);
	});

	test("reclaims abandoned and missing-writer temporary records", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const abandoned_temporary = join(cache_directory, `abandoned.json.${process.pid}.tmp`);
		const abandoned_unique_temporary = join(
			cache_directory,
			`abandoned.json.${process.pid}.00000000-0000-4000-8000-000000000000.tmp`,
		);
		const missing_writer_temporary = join(
			cache_directory,
			"missing.json.2147483647.00000000-0000-4000-8000-000000000002.tmp",
		);
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(abandoned_temporary).write_text("abandoned temporary record");
		fixture._file_io.file(abandoned_unique_temporary).write_text("abandoned unique temporary record");
		fixture._file_io.file(missing_writer_temporary).write_text("missing writer temporary record");
		const result = cache.cached_violations();
		const temporary_state = {
			abandoned: fixture._file_io.file(abandoned_temporary).path_exists(),
			abandoned_unique: fixture._file_io.file(abandoned_unique_temporary).path_exists(),
			missing_writer: fixture._file_io.file(missing_writer_temporary).path_exists(),
		};
		expect({ available: result.available, temporary_state }).toEqual({
			available: false,
			temporary_state: { abandoned: false, abandoned_unique: false, missing_writer: false },
		});
	});

	test("retains another process's active temporary record", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const active_writer_temporary = join(
			cache_directory,
			`active.json.${process.ppid}.00000000-0000-4000-8000-000000000001.tmp`,
		);
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(active_writer_temporary).write_text("active other-process temporary record");
		const result = cache.cached_violations();
		const active_writer_remains = fixture._file_io.file(active_writer_temporary).path_exists();
		expect({ available: result.available, active_writer_remains }).toEqual({
			available: false,
			active_writer_remains: true,
		});
	});

	test("reclaims an abandoned temporary before publishing a later result", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const abandoned_temporary = join(
			cache_directory,
			`abandoned.json.${process.pid}.00000000-0000-4000-8000-000000000002.tmp`,
		);
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(abandoned_temporary).write_text("abandoned temporary record");
		cache.write([fixture._violation]);
		const result = cache.cached_violations();
		const abandoned_file_remains = fixture._file_io.file(abandoned_temporary).path_exists();
		expect({ abandoned_file_remains, cache_available: result.available }).toEqual({
			abandoned_file_remains: false,
			cache_available: true,
		});
	});

	test("preserves publication and cleanup failures as an aggregate", async () => {
		const failure = new Error("EIO: injected global-cache write failure");
		const file_io = new CachePublicationFaultFileIO({
			schedule: CachePublicationFaultSchedule.WriteAfterTempCreatedCleanupFails,
			failure,
		});
		const fixture = fixtures.create(file_io);
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const publication_errors = await Promise.resolve()
			.then(() => cache.write([fixture._violation]))
			.then(
				() => [],
				(error: AggregateError) => error.errors,
			);
		const temporary_files_before_reaping = file_io.temporary_files(cache_directory);
		const cached_result = cache.cached_violations();
		const temporary_files_after_reaping = file_io.temporary_files(cache_directory);
		expect({
			publication_errors,
			temporary_files_before_reaping: temporary_files_before_reaping.length,
			cache_available_after_retry: cached_result.available,
			temporary_files_after_reaping,
		}).toEqual({
			publication_errors: [
				failure,
				expect.objectContaining({ message: expect.stringContaining("injected temporary cleanup failure") }),
			],
			temporary_files_before_reaping: 1,
			cache_available_after_retry: false,
			temporary_files_after_reaping: [],
		});
	});

	test("keeps reentrant writer temporaries isolated", () => {
		const file_io = new CachePublicationConcurrentWriterFileIO();
		const fixture = fixtures.create(file_io);
		const cache_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const first_cache = new GlobalAnalysisCache(cache_options);
		const second_cache = new GlobalAnalysisCache(cache_options);
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const nested_violation = new ViolationValue({
			file: fixture._violation.file(),
			line: fixture._violation.line(),
			message: "nested writer result",
			hint: fixture._violation.hint(),
			rule_id: fixture._violation.rule_id(),
			priority: fixture._violation.priority(),
		});
		file_io.schedule_write(() => second_cache.write([nested_violation]));
		first_cache.write([fixture._violation]);
		const nested_write_count = file_io.completed_write_count();
		const temporary_files = file_io.temporary_files(cache_directory);
		expect({ nested_write_count, temporary_files }).toEqual({ nested_write_count: 1, temporary_files: [] });
	});

	test("publishes the outer result after a reentrant writer", () => {
		const file_io = new CachePublicationConcurrentWriterFileIO();
		const fixture = fixtures.create(file_io);
		const cache_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const first_cache = new GlobalAnalysisCache(cache_options);
		const second_cache = new GlobalAnalysisCache(cache_options);
		const nested_violation = new ViolationValue({
			file: fixture._violation.file(),
			line: fixture._violation.line(),
			message: "nested writer result",
			hint: fixture._violation.hint(),
			rule_id: fixture._violation.rule_id(),
			priority: fixture._violation.priority(),
		});
		file_io.schedule_write(() => second_cache.write([nested_violation]));
		first_cache.write([fixture._violation]);
		const result = first_cache.cached_violations();
		const messages = result.value.map((violation) => violation.message());
		const second_cache_result = second_cache.cached_violations();
		const second_cache_messages = second_cache_result.value.map((violation) => violation.message());
		expect({
			available: result.available,
			messages,
			second_cache_available: second_cache_result.available,
			second_cache_messages,
		}).toEqual({
			available: true,
			messages: [fixture._violation.message()],
			second_cache_available: true,
			second_cache_messages: [fixture._violation.message()],
		});
	});
});
