import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
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

	test("formats all TypeScript source and test directories", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const formatting = definitions
			.type_script_checks()
			.find((check) => check.label === "TypeScript formatting");

		expect(formatting?.args).toEqual([
			"--dir",
			PROJECT_ROOT,
			"exec",
			"biome",
			"format",
			"--write",
			`${PROJECT_ROOT}/test-runner.ts`,
			`${PROJECT_ROOT}/src/bridge/ts/core/cli.ts`,
			`${PROJECT_ROOT}/tests`,
		]);
	});

	test("uses project-root paths for Python formatting", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const black = checks.find((check) => check.label === "Python formatting");

		expect(black?.args.at(-1)).toBe(`${PROJECT_ROOT}/src/parser/python-bridge`);
	});

	test("checks nested Python files with project-root paths", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const pyflakes = checks.find(
			(check) => check.label === "Python unused imports and names",
		);
		const vulture = checks.find(
			(check) => check.label === "Python unused functions and classes",
		);

		expect({
			pyflakes_paths: pyflakes?.args
				.slice(2)
				.every((file) => file.startsWith(`${PROJECT_ROOT}/`)),
			pyflakes_nested_file: pyflakes?.args.includes(
				`${PROJECT_ROOT}/src/parser/python-bridge/implementation/ast/ast_bridge.py`,
			),
			vulture_paths: vulture?.args.includes(`${PROJECT_ROOT}/tests`),
		}).toEqual({
			pyflakes_paths: true,
			pyflakes_nested_file: true,
			vulture_paths: true,
		});
	});

	test("passes the bridge path to Python type checking", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const mypy = definitions
			.python_checks()
			.find((check) => check.label === "Python type checking");

		expect(mypy?.environment.MYPYPATH).toBe(
			`${PROJECT_ROOT}/src/parser/python-bridge`,
		);
	});

	test("uses the project root for the lint command", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const lint = definitions
			.repository_checks()
			.find((check) => check.label === "Coding lint");

		expect(lint?.args.slice(0, 2)).toEqual(["--dir", PROJECT_ROOT]);
		expect(lint?.args).toEqual(["--dir", PROJECT_ROOT, "lint"]);
	});
});
