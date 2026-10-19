#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { CommandExecution } from "test-runner/command_execution";
import { PROJECT_ROOT } from "test-runner/constants";
import { TestExecution } from "test-runner/test_execution";

{
	const TEST_RUNNER = new TestExecution(PROJECT_ROOT, new CommandExecution(spawnSync));
	const PROVIDED_ARGS = process.argv.slice(2).filter((argument) => argument !== "--");
	TEST_RUNNER.run_args(PROVIDED_ARGS);
}
