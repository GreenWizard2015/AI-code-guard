import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";
import { CommittedCacheRecordRaceFileIO } from "tests/core/cache/committed-cache-record-race-file-io";

describe("GlobalAnalysisCache committed-record pruning", () => {
	const fixtures = new CacheFixtureBuilder();
	test("treats concurrent ENOENT as a cache miss", async () => {
		const file_io = new CommittedCacheRecordRaceFileIO(new Error("ENOENT: cache record already removed"));
		const fixture = fixtures.create(file_io);
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const obsolete_record = join(cache_directory, "obsolete.json");
		file_io.create_directory(cache_directory);
		file_io.file(obsolete_record).write_text("obsolete");
		file_io.schedule_removal_race(obsolete_record);
		const outcome = await Promise.resolve()
			.then(() => cache.cached_violations())
			.then(
				(result) => ({ state: result.available ? "hit" : "miss", error: "" }),
				(reason: unknown) => ({ state: "error", error: String(reason) }),
			);
		const peer_removed_record = !file_io.path_exists(obsolete_record);

		expect({ ...outcome, peer_removed_record }).toEqual({ state: "miss", error: "", peer_removed_record: true });
	});

	test("preserves non-ENOENT failures", async () => {
		const file_io = new CommittedCacheRecordRaceFileIO(new Error("EIO: cache device failed"));
		const fixture = fixtures.create(file_io);
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const obsolete_record = join(cache_directory, "obsolete.json");
		file_io.create_directory(cache_directory);
		file_io.file(obsolete_record).write_text("obsolete");
		file_io.schedule_removal_race(obsolete_record);
		const outcome = await Promise.resolve()
			.then(() => cache.cached_violations())
			.then(
				(result) => ({ state: result.available ? "hit" : "miss", error: "" }),
				(reason: unknown) => ({ state: "error", error: String(reason) }),
			);
		const peer_removed_record = !file_io.path_exists(obsolete_record);

		expect({ ...outcome, peer_removed_record }).toEqual({
			state: "error",
			error: "Error: EIO: cache device failed",
			peer_removed_record: true,
		});
	});
});
