import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { ViolationValue } from "src/model/violation_value";
import { CachePublicationConcurrentWriterFileIO } from "tests/bridge/ts/core/cache/cache_publication_concurrent_writer_file_io";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("GlobalAnalysisCache reentrant writers", () => {
	const fixtures = new CacheFixtureBuilder();

	test("reclaims abandoned temporaries before publishing", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture._file]), new Set(), []));
		const cache_directory = join(fixture._root, AI_CODE_GUARD_DIRECTORY, "cache", "global");
		const abandoned_temporary = join(
			cache_directory,
			`abandoned.json.${process.pid}.00000000-0000-4000-8000-000000000002.tmp`,
		);
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(abandoned_temporary).write_text("abandoned temporary record");

		cache.write([fixture._violation]);
		const result = cache.cached_violations();
		const abandoned_exists = fixture._file_io.file(abandoned_temporary).path_exists();
		expect({ abandoned_exists, available: result.available }).toEqual({
			abandoned_exists: false,
			available: true,
		});
	});

	test("keeps nested writer temporary files isolated", () => {
		const file_io = new CachePublicationConcurrentWriterFileIO();
		const fixture = fixtures.create(file_io);
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const first_cache = new GlobalAnalysisCache(options);
		const second_cache = new GlobalAnalysisCache(options);
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
		const remaining_temporary_files = file_io.temporary_files(cache_directory);
		expect({ nested_write_count, remaining_temporary_files }).toEqual({
			nested_write_count: 1,
			remaining_temporary_files: [],
		});
	});

	test("publishes the outer result after a reentrant writer", () => {
		const file_io = new CachePublicationConcurrentWriterFileIO();
		const fixture = fixtures.create(file_io);
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const first_cache = new GlobalAnalysisCache(options);
		const second_cache = new GlobalAnalysisCache(options);
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
		const first_result = first_cache.cached_violations();
		const first_messages = first_result.value.map((violation) => violation.message());
		const second_result = second_cache.cached_violations();
		const second_messages = second_result.value.map((violation) => violation.message());
		expect({
			first_available: first_result.available,
			first_messages,
			second_available: second_result.available,
			second_messages,
		}).toEqual({
			first_available: true,
			first_messages: [fixture._violation.message()],
			second_available: true,
			second_messages: [fixture._violation.message()],
		});
	});
});
