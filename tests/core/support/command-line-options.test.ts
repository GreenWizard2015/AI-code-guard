import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import "src/core/lint_project_context_creator";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { CommandLineOptions } from "src/core/support/command_line_options";

describe("command line options", () => {
	test("skips architecture review when no review agent is selected", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli"]);

		expect({ review_agent: options.review_agent, skip_review: options.skip_review }).toEqual({
			review_agent: "none",
			skip_review: true,
		});
	});

	test("enables review cleanup explicitly", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli", "--review-cleanup"]);
		expect(options.review_cleanup).toBe(true);
	});

	test("enables forced architecture review explicitly", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli", "--force-review"]);
		expect({ skip_review: options.skip_review, force_review: options.force_review }).toEqual({
			skip_review: true,
			force_review: true,
		});
	});

	test("keeps review cleanup disabled by default", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli"]);

		expect({
			skip_review: options.skip_review,
			force_review: options.force_review,
			review_cleanup: options.review_cleanup,
			review_agent: options.review_agent,
		}).toEqual({
			skip_review: true,
			force_review: false,
			review_cleanup: false,
			review_agent: "none",
		});
	});

	test("enables review when a provider is explicitly selected", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli", "--review-agent", "codex"]);

		expect({ review_agent: options.review_agent, skip_review: options.skip_review }).toEqual({
			review_agent: "codex",
			skip_review: false,
		});
	});

	test("runs the CLI outside the project with ignored source context and no review agent", () => {
		const project_root = fileURLToPath(new URL("../../..", import.meta.url));
		const cli_path = `${project_root}/src/core/cli.ts`;
		const tsx_path = createRequire(import.meta.url).resolve("tsx/cli");
		const ignored_source_directory = `${project_root}/src/core`;
		const parser = new CommandLineOptions();
		const options = parser.from_arguments([
			"node",
			cli_path,
			"--root",
			project_root,
			"--ignore-dir",
			ignored_source_directory,
		]);
		const result = spawnSync(
			process.execPath,
			[tsx_path, cli_path, "--root", options.root, "--ignore-dir", ignored_source_directory],
			{
				cwd: tmpdir(),
				encoding: "utf8",
				timeout: 120_000,
			},
		);
		const output = `${result.stdout}\n${result.stderr}`;

		expect({
			spawn_error: result.error?.message,
			review_agent: options.review_agent,
			lint_completed: output.includes("Total issues:"),
			context_count_mismatch: output.includes("different file counts"),
		}).toEqual({
			spawn_error: undefined,
			review_agent: "none",
			lint_completed: true,
			context_count_mismatch: false,
		});
	});
});
