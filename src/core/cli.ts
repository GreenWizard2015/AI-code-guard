#!/usr/bin/env node

import { CliApplication } from "src/core/cli_application";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { CLI_ENTRY } from "src/constants";

/** Responsibilities: _CLI entrypoint execution_. **/
async function start_cli(): Promise<void> {
	if (process.argv.length < 2) {
		return;
	}
	const entry_file = process.argv[1];
	if (entry_file === undefined) {
		return;
	}
	if (!entry_file.endsWith(CLI_ENTRY)) {
		return;
	}
	const previous_exit_code = process.exitCode;
	const cli = new CliApplication(new NodeFileIO(), new SourceText());
	await cli.run_cli();
	if (previous_exit_code !== undefined && process.exitCode === undefined) {
		process.exitCode = previous_exit_code;
	}
}

await start_cli();
