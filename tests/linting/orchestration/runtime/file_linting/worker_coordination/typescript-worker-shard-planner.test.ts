import { describe, expect, test } from "@jest/globals";
import { TypeScriptWorkerShardPlanner } from "src/linting/orchestration/runtime/file_linting/worker_coordination/type_script_worker_shard_planner";

describe("TypeScript worker shard planning", () => {
	test.each([
		[0, 0],
		[0, 199],
		[1, 200],
		[1, 399],
		[2, 400],
		[2, 599],
		[3, 600],
		[3, 799],
		[4, 800],
		[4, 1459],
	])("selects %i workers for %i files", (worker_count, file_count) => {
		const planner = new TypeScriptWorkerShardPlanner();
		expect(planner.worker_count(file_count)).toBe(worker_count);
	});

	test("moves a small tail slice to the main shard without dropping or repeating files", () => {
		const planner = new TypeScriptWorkerShardPlanner();
		const files = Array.from({ length: 1459 }, (_, index) => `file-${index}.ts`);
		const shards = planner.shards(files);
		const shard_sizes = shards.map((shard) => shard.length);
		const flattened_files = shards.flat();
		const all_shards_meet_minimum = shards.every((shard) => shard.length >= 200);

		expect({ shard_count: shards.length, shard_sizes, flattened_files, all_shards_meet_minimum }).toEqual({
			shard_count: 4,
			shard_sizes: [401, 365, 365, 328],
			flattened_files: files,
			all_shards_meet_minimum: true,
		});
	});

	test("preserves minimum-sized shards when no transferable files remain", () => {
		const planner = new TypeScriptWorkerShardPlanner();
		const files = Array.from({ length: 800 }, (_, index) => index);
		const shards = planner.shards(files);

		expect(shards.map((shard) => shard.length)).toEqual([200, 200, 200, 200]);
	});

	test("keeps sub-threshold scopes serial and starts a lane at the minimum", () => {
		const planner = new TypeScriptWorkerShardPlanner();
		const below_threshold = Array.from({ length: 199 }, (_, index) => index);
		const at_threshold = Array.from({ length: 200 }, (_, index) => index);
		const below_threshold_shards = planner.shards(below_threshold);
		const minimum_shards = planner.shards(at_threshold);
		const minimum_shard_sizes = minimum_shards.map((shard) => shard.length);

		expect({ below_threshold_shards, minimum_shard_sizes }).toEqual({
			below_threshold_shards: [],
			minimum_shard_sizes: [200],
		});
	});
});
