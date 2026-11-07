import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import {
	CACHE_DIRECTORY,
	CACHE_INPUT_STABILITY_ATTEMPTS,
	INPUT_TOPOLOGY_CHANGED_MESSAGE,
	LINT_EXECUTION_CACHE_DIRECTORY,
	LINT_EXECUTION_CACHE_FILE,
} from "src/core/constants";
import { LintStageTimer } from "src/lint_stage_timer";
import type { LintInputFiles } from "src/project_analysis_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("cache input topology stability", () => {
	test("retries preparation when discovery changes once", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const new_file = join(fixture.root, "discovery-drift.ts");
		let discovery_calls = 0;
		const changed_inputs: LintInputFiles = {
			...fixture._inputs,
			files: [...fixture._inputs.files, new_file],
			project_files: [...fixture._inputs.project_files, new_file],
		};
		const input_discovery = {
			input_files: (): LintInputFiles => {
				discovery_calls += 1;
				if (discovery_calls === 1) {
					fixture.write_source(new_file, "export const next = 2;\n");
				}
				return changed_inputs;
			},
		};
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: input_discovery,
			file_io: fixture._file_io,
			source_io: fixture._source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const prepared = preparer.prepare_for_inputs(fixture._inputs);

		expect({ includes_new_file: prepared.inputs.files.includes(new_file), discovery_calls }).toEqual({
			includes_new_file: true,
			discovery_calls: 2,
		});
	});

	test("rejects continually changing input discovery without publishing a result", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		let discovery_calls = 0;
		let files = [...fixture._inputs.files];
		let project_files = [...fixture._inputs.project_files];
		const input_discovery = {
			input_files: (): LintInputFiles => {
				const new_file = join(fixture.root, `discovery-drift-${discovery_calls}.ts`);
				fixture.write_source(new_file, "export const next = 2;\n");
				discovery_calls += 1;
				files = [...files, new_file];
				project_files = [...project_files, new_file];
				return { ...fixture._inputs, files, project_files };
			},
		};
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: input_discovery,
			file_io: fixture._file_io,
			source_io: fixture._source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const cache_file = join(
			fixture.root,
			AI_CODE_GUARD_DIRECTORY,
			CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_DIRECTORY,
			LINT_EXECUTION_CACHE_FILE,
		);

		expect(() => preparer.prepare_for_inputs(fixture._inputs)).toThrow(INPUT_TOPOLOGY_CHANGED_MESSAGE);
		expect({
			discovery_calls,
			published_cache: fixture._file_io.path_exists(cache_file),
		}).toEqual({
			discovery_calls: CACHE_INPUT_STABILITY_ATTEMPTS,
			published_cache: false,
		});
	});
});
