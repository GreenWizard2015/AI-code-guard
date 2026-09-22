import { QualityCheckDefinitions } from "tests/core/quality-check-definitions";
import { PROJECT_ROOT } from "tests/core/constants";
import { describe, expect, test } from "@jest/globals";

describe("coding lint quality checks", () => {
	test("enables unreachable-condition diagnostics in Mypy", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const mypy = checks.find((check) => check.label === "Python type checking");

		expect(mypy).toEqual(
			expect.objectContaining({
				command: "python3",
				args: expect.arrayContaining(["-m", "mypy", "--warn-unreachable"]),
			}),
		);
	});

	test("runs Ruff against the Python bridge with an absolute path", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const ruff = checks.find((check) => check.label === "Ruff Python linting");

		expect(ruff).toEqual({
			label: "Ruff Python linting",
			command: "python3",
			args: [
				"-m",
				"ruff",
				"check",
				"--isolated",
				"--select",
				"E4,E7,E9,F",
				`${PROJECT_ROOT}/src/parser/python-bridge`,
			],
			environment: process.env,
		});
	});
});
