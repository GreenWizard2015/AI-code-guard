#!/usr/bin/env node

import { CliApplication } from "src/core/cli_application";
import { IS_CLI_ENTRY } from "src/core/constants";
import { CommandLineOptions } from "src/core/support/cli/command_line_options";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";

/** Responsibilities: _CLI entry composition_, _process status handling_. **/
export async function run_cli_entry(): Promise<void> {
	const stage_timer = new LintStageTimer();
	const command_line_options = new CommandLineOptions(process.argv);
	const parsed_options = stage_timer.measure("startup", () =>
		stage_timer.measure("startup.cli-options", () => command_line_options.validated_options()),
	);
	if (!parsed_options.valid()) {
		console.error(parsed_options.error_message());
		process.exit(2);
	}
	const cli = new CliApplication(new NodeFileIO(process.cwd()), new SourceText());
	const status = await cli.run_project(parsed_options.options(), stage_timer);
	if (status.lint_failed || status.review_failed) {
		process.exit(1);
	}
}

if (IS_CLI_ENTRY) {
	await run_cli_entry();
}
