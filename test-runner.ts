#!/usr/bin/env node

import { TestExecution } from "tests/core/test-runner";

{
	const TEST_RUNNER = new TestExecution();
	TEST_RUNNER.run_args(process.argv.slice(2));
}
