#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CommandExecution } from "test-runner/command_execution";
import { TestExecution } from "test-runner/test_execution";

{
	const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const COMMAND_RUNNER = new CommandExecution(spawnSync);
	const TEST_RUNNER = new TestExecution(ROOT, COMMAND_RUNNER, { stdout: process.stdout, stderr: process.stderr });
	const ARGUMENT_SEPARATOR = "--";
	const PROCESS_ARGUMENTS = process.argv.slice(2);
	const PROVIDED_ARGS = PROCESS_ARGUMENTS.filter((argument) => argument !== ARGUMENT_SEPARATOR);
	const STATUS = TEST_RUNNER.run_args(PROVIDED_ARGS);
	if (STATUS !== 0) {
		process.exit(STATUS);
	}
}
