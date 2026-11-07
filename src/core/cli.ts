#!/usr/bin/env node

import { CLI_ENTRY } from "src/constants";
import { CliApplication } from "src/core/cli_application";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";

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
	const cli = new CliApplication(new NodeFileIO(process.cwd()), new SourceText());
	const STATUS = await cli.run_cli(process.argv);
	if (STATUS.lint_failed || STATUS.review_failed) {
		process.exit(1);
	}
}

await start_cli();
