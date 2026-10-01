#!/usr/bin/env node

import { TestExecution } from "test-runner/execution";

{
	const TEST_RUNNER = new TestExecution();
	TEST_RUNNER.run_args(process.argv.slice(2));
}
