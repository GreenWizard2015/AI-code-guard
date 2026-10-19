import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { QualityCheckDefinitions } from "test-runner/quality_check_definitions";
import { PROJECT_ROOT } from "tests/core/constants";

describe("coding lint quality checks", () => {
	test("enables unreachable-condition diagnostics in Mypy", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const mypy = checks.find((check) => check.label === "Python type checking");

		expect(mypy).toEqual(
			expect.objectContaining({
				command: "python3",
				args: expect.arrayContaining(["-m", "mypy", "--warn-unreachable"]),
				supports_review_options: false,
				supports_review_agent: false,
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
			args: ["-m", "ruff", "check", "--isolated", "--select", "E4,E7,E9,F", `${PROJECT_ROOT}/src/python-bridge`],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		});
	});

	test("formats all TypeScript source and test directories", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const formatting = definitions.type_script_checks().find((check) => check.label === "TypeScript formatting");

		expect(formatting?.args).toEqual([
			"--dir",
			PROJECT_ROOT,
			"exec",
			"biome",
			"format",
			"--write",
			`${PROJECT_ROOT}/test-runner/cli.ts`,
			`${PROJECT_ROOT}/src/core/cli.ts`,
			`${PROJECT_ROOT}/tests`,
		]);
	});

	test("uses project-root paths for Python formatting", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const black = checks.find((check) => check.label === "Python formatting");

		expect(black?.args.at(-1)).toBe(`${PROJECT_ROOT}/src/python-bridge`);
	});

	test("checks nested Python files with project-root paths", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const pyflakes = checks.find((check) => check.label === "Python unused imports and names");
		const vulture = checks.find((check) => check.label === "Python unused functions and classes");

		expect({
			pyflakes_paths: pyflakes?.args.slice(2).every((file) => file.startsWith(`${PROJECT_ROOT}/`)),
			pyflakes_nested_file: pyflakes?.args.includes(
				`${PROJECT_ROOT}/src/python-bridge/implementation/ast/python_ast_bridge.py`,
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
		const mypy = definitions.python_checks().find((check) => check.label === "Python type checking");

		expect(mypy?.environment.MYPYPATH).toBe(`${PROJECT_ROOT}/src/python-bridge`);
	});

	test("uses the project root for the lint command", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const lint = definitions.repository_checks().find((check) => check.label === "Coding lint");
		const expected_arguments = ["--dir", PROJECT_ROOT, "lint"];
		const external_directory = join(PROJECT_ROOT, "external");
		if (existsSync(external_directory)) {
			expected_arguments.push("--ignore-dir", external_directory);
		}

		expect(lint?.args.slice(0, 2)).toEqual(["--dir", PROJECT_ROOT]);
		expect(lint).toEqual(
			expect.objectContaining({
				args: expected_arguments,
				supports_review_options: true,
				supports_review_agent: true,
			}),
		);
	});

	test("ignores the external directory only when it exists", () => {
		const project_root = mkdtempSync(join(tmpdir(), "quality-check-external-"));
		mkdirSync(join(project_root, "external"));
		const definitions = new QualityCheckDefinitions(project_root);
		const lint = definitions.repository_checks().find((check) => check.label === "Coding lint");
		const arguments_list = lint?.args;
		rmSync(project_root, { recursive: true, force: true });

		expect(arguments_list).toEqual(["--dir", project_root, "lint", "--ignore-dir", join(project_root, "external")]);
	});

	test("validates rule documentation immediately after coding lint", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.repository_checks();
		const lint_index = checks.findIndex((check) => check.label === "Coding lint");
		const documentation_check = checks[lint_index + 1];

		expect(documentation_check).toEqual({
			label: "Rule documentation validation",
			command: "pnpm",
			args: ["--dir", PROJECT_ROOT, "validate:rule-docs"],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		});
	});

	test("points Python type checking at the bridge entrypoint", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const python_type_check = definitions.python_checks().find((check) => check.label === "Python type checking");

		expect(python_type_check?.args.at(-1)).toBe("python_bridge_entrypoint");
	});
});
