import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "src/core/lint_project_context_creator";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";
import { OUTSIDE_PROJECT_MODULE_NAME, TSX_IMPORT_API_SPECIFIER } from "tests/core/constants";
import { OutsideRootModuleImportScenario } from "tests/core/support/outside_root_module_import_scenario";

describe("command line options", () => {
	test("parses a positive agent count and preserves the default without the option", () => {
		const defaults_parser = new CommandLineOptions(["node", "cli"]);
		const configured_parser = new CommandLineOptions(["node", "cli", "--agents", "1"]);
		const defaults = defaults_parser.value();
		const configured = configured_parser.value();

		expect({
			default_agent_mode: defaults.agent_mode,
			configured_agent_mode: configured.agent_mode,
		}).toEqual({
			default_agent_mode: { package_count: 0, test_target_links: [] },
			configured_agent_mode: { package_count: 1, test_target_links: [] },
		});
	});

	test.each(["0", "-1", "1.5", "abc"])("rejects invalid --agents value %s", (value) => {
		const parser = new CommandLineOptions(["node", "cli", "--agents", value]);
		const result = parser.validated_options();
		expect({ valid: result.valid(), error_message: result.error_message() }).toEqual({
			valid: false,
			error_message: `Invalid --agents value: ${value}`,
		});
	});

	test("rejects --agents without a value", () => {
		const parser = new CommandLineOptions(["node", "cli", "--agents"]);
		const result = parser.validated_options();
		expect({ valid: result.valid(), error_message: result.error_message() }).toEqual({
			valid: false,
			error_message: "Invalid --agents value: ",
		});
	});

	test("enforces the hidden minimum batch size only when agents are enabled", () => {
		const agent_parser = new CommandLineOptions(["node", "cli", "--agents", "2", "--batch-size", "9"]);
		const solo_parser = new CommandLineOptions(["node", "cli", "--batch-size", "9"]);
		const agent_result = agent_parser.validated_options();
		const solo_result = solo_parser.validated_options();
		expect({ valid: agent_result.valid(), error_message: agent_result.error_message() }).toEqual({
			valid: false,
			error_message: "Invalid --batch-size value with --agents: expected at least 10.",
		});
		expect({ valid: solo_result.valid(), batch_size: solo_result.options().batch_size }).toEqual({
			valid: true,
			batch_size: 9,
		});
	});

	test("skips architecture review when no review agent is selected", () => {
		const command_line_options = new CommandLineOptions(["node", "cli"]);
		const options = command_line_options.value();

		expect({ review_agent: options.review_agent, skip_review: options.skip_review }).toEqual({
			review_agent: "none",
			skip_review: true,
		});
	});

	test("enables forced architecture review explicitly", () => {
		const command_line_options = new CommandLineOptions(["node", "cli", "--force-review"]);
		const options = command_line_options.value();
		expect({ skip_review: options.skip_review, force_review: options.force_review }).toEqual({
			skip_review: true,
			force_review: true,
		});
	});

	test.each(["codex", "cx", "cxa", "claude"] as const)("enables review with provider %s", (agent) => {
		const command_line_options = new CommandLineOptions(["node", "cli", "--review-agent", agent]);
		const options = command_line_options.value();

		expect({ review_agent: options.review_agent, skip_review: options.skip_review }).toEqual({
			review_agent: agent,
			skip_review: false,
		});
	});

	test("runs the CLI in memory with an ignored source directory and no review agent", async () => {
		const fixture_factory = new TaskReviewMemoryFixture();
		const fixture = fixture_factory.create("export const INCLUDED_VALUE = true;\n");
		const ignored_directory = join(fixture._root, "src/core");
		const ignored_source = join(ignored_directory, "ignored.ts");
		const options_parser = new CommandLineOptions([
			"node",
			"cli",
			"--root",
			fixture._root,
			"--ignore-dir",
			ignored_directory,
		]);
		const options = options_parser.value();
		const observed = await fixture.run_cli_ignoring_source(
			options,
			ignored_source,
			"export const INVALID_SOURCE = ;\n",
		);
		expect(observed).toEqual({
			review_failed: false,
			ignored_source_reported: false,
			report_written: true,
		});
	});

	test("loads lint configuration outside the repository without a child process", async () => {
		const project_root = fileURLToPath(new URL("../../..", import.meta.url));
		const configuration_path = join(project_root, "src/core/lint_run_configuration.ts");
		const options_parser = new CommandLineOptions(["node", "cli", "--root", tmpdir()]);
		const options = options_parser.value();
		const tsx_api_path = createRequire(import.meta.url).resolve(TSX_IMPORT_API_SPECIFIER);
		const scenario = new OutsideRootModuleImportScenario(configuration_path, tsx_api_path);
		const load_result = await scenario.load(options.root, OUTSIDE_PROJECT_MODULE_NAME);
		expect(load_result).toBe("loaded");
	});
});
