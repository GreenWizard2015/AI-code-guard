import "src/bridge/ts/core/context-factory";
import { describe, expect, test } from "@jest/globals";
import { CommandLineOptions } from "src/bridge/ts/core/support/cli-options-parser";

describe("command line options", () => {
	test("enables review skipping explicitly", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli", "--skip-review"]);
		expect(options.skip_review).toBe(true);
	});

	test("keeps review enabled by default", () => {
		const parser = new CommandLineOptions();
		const options = parser.from_arguments(["node", "cli"]);
		expect(options.skip_review).toBe(false);
	});
});
