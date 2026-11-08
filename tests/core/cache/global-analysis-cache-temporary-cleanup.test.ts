import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { CachePublicationFaultFileIO } from "tests/bridge/ts/core/cache/cache_publication_fault_file_io";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CachePublicationFaultSchedule } from "tests/bridge/ts/core/cache/types";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("GlobalAnalysisCache temporary cleanup", () => {
	const fixtures = new CacheFixtureBuilder();

	test("reclaims abandoned and missing-writer temporary records", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
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

	test("continues after another cleaner removes an inventoried temporary", () => {
		const file_io = new CachePublicationFaultFileIO({
			schedule: CachePublicationFaultSchedule.ConcurrentCleanupRace,
			failure: new Error("injected concurrent cleanup race"),
		});
		const fixture = fixtures.create(file_io);
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const orphan_name = "orphan.json.2147483647.00000000-0000-4000-8000-000000000002.tmp";
		const orphan = join(cache_directory, orphan_name);
		file_io.create_directory(cache_directory);
		file_io.file(orphan).write_text("orphan");

		const result = cache.cached_violations();
		expect({ available: result.available, orphan_exists: file_io.file(orphan).path_exists() }).toEqual({
			available: false,
			orphan_exists: false,
		});
	});

	test("retains another process's active temporary record", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const active_temporary = join(
			cache_directory,
			`active.json.${process.ppid}.00000000-0000-4000-8000-000000000001.tmp`,
		);
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(active_temporary).write_text("active temporary record");

		const result = cache.cached_violations();
		const active_exists = fixture._file_io.file(active_temporary).path_exists();
		expect({ available: result.available, active_exists }).toEqual({
			available: false,
			active_exists: true,
		});
	});
});
