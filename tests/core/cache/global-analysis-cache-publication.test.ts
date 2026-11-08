import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { CachePublicationFaultFileIO } from "tests/bridge/ts/core/cache/cache_publication_fault_file_io";
import { CachePublicationFaultSchedule } from "tests/bridge/ts/core/cache/types";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("GlobalAnalysisCache publication", () => {
	const fixtures = new CacheFixtureBuilder();
	const fault_schedules = [
		CachePublicationFaultSchedule.WriteAfterTempCreated,
		CachePublicationFaultSchedule.RenameTemp,
	];

	test.each(fault_schedules)("cleans temporary files and preserves %s", async (schedule) => {
		const failure = new Error(`injected global-analysis-cache ${schedule} failure`);
		const file_io = new CachePublicationFaultFileIO({ schedule, failure });
		const fixture = fixtures.create(file_io);
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const observed_error = await Promise.resolve()
			.then(() => cache.write([fixture._violation]))
			.then(
				() => "",
				(error: unknown) => String(error),
			);
		const remaining_temporary_files = file_io.temporary_files(cache_directory);

		expect({ observed_error, remaining_temporary_files }).toEqual({
			observed_error: String(failure),
			remaining_temporary_files: [],
		});
	});

	test("preserves publication and cleanup failures as an aggregate", async () => {
		const failure = new Error("EIO: injected global-cache write failure");
		const file_io = new CachePublicationFaultFileIO({
			schedule: CachePublicationFaultSchedule.WriteAfterTempCreatedCleanupFails,
			failure,
		});
		const fixture = fixtures.create(file_io);
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
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
});
