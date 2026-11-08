import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import assert from "node:assert/strict";
import { delimiter, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { MYPYPATH_VARIABLE } from "test-runner/constants";
import { QualityCheckDefinitions } from "test-runner/quality_check_definitions";
import { PROJECT_ROOT } from "tests/core/constants";

describe("coding lint quality checks", () => {
	test("excludes .codex Python files while retaining project and test sources", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const python_files = definitions
			.python_checks()
			.flatMap((check) => check.args.filter((argument) => argument.startsWith(`${PROJECT_ROOT}/`)))
			.filter((argument) => argument.endsWith(".py"));

		expect({
			codex_sources_excluded: python_files.every((file) => !file.includes("/.codex/")),
			project_source_included: python_files.includes(
				`${PROJECT_ROOT}/src/python-bridge/implementation/ast/python_ast_bridge.py`,
			),
			project_test_included: python_files.includes(
				`${PROJECT_ROOT}/tests/python-bridge/test_python_bridge_entrypoint.py`,
			),
		}).toEqual({
			codex_sources_excluded: true,
			project_source_included: true,
			project_test_included: true,
		});
	});

	test("checks all project Python sources and enables Mypy unreachable diagnostics", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const mypy = checks.find((check) => check.label === "Python type checking");
		assert.ok(mypy);
		const python_files = mypy.args.filter((file) => file.endsWith(".py"));
		/** Responsibilities: _project source path matching_. **/
		const has_project_file = (path: string): boolean => python_files.some((file) => file.endsWith(path));
		const source_directory = join("src", "python-bridge");
		const has_python_files = python_files.length > 0;
		const has_performance_cli = has_project_file(join("performance", "cli.py"));
		const has_python_bridge_entry = has_project_file(
			join("tests", "python-bridge", "test_python_bridge_entrypoint.py"),
		);
		const has_python_bridge_source = python_files.some((file) => file.includes(source_directory));
		const checks_all_project_sources = [
			has_python_files,
			has_performance_cli,
			has_python_bridge_entry,
			has_python_bridge_source,
		].every(Boolean);

		expect({
			command: mypy.command,
			all_project_sources_checked: checks_all_project_sources,
			strict: mypy.args.includes("--strict"),
			extra_checks: mypy.args.includes("--extra-checks"),
			unreachable: mypy.args.includes("--warn-unreachable"),
			package_bases: mypy.args.includes("--explicit-package-bases"),
			imports_not_skipped: !mypy.args.includes("--follow-imports=skip"),
			missing_imports_not_ignored: !mypy.args.includes("--ignore-missing-imports"),
			supports_review_options: mypy.supports_review_options,
			supports_review_agent: mypy.supports_review_agent,
		}).toEqual({
			command: "python3",
			all_project_sources_checked: true,
			strict: true,
			extra_checks: true,
			unreachable: true,
			package_bases: true,
			imports_not_skipped: true,
			missing_imports_not_ignored: true,
			supports_review_options: false,
			supports_review_agent: false,
		});
	});

	test("runs every Ruff rule against all project Python files", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const ruff_checks = checks.filter((check) => check.label === "Ruff Python linting");
		const ruff_arguments = ruff_checks.flatMap((check) => check.args);
		const ignored_rule_index = ruff_arguments.indexOf("--ignore");
		const ignored_rules = ruff_arguments.slice(ignored_rule_index + 1, ignored_rule_index + 2).join();
		const conflicting_rule_ids = ["PLR0911", "PLR5501", "TC006", "SIM108"];
		const private_member_ignore = ruff_arguments.indexOf("tests/**/*.py:SLF001");
		const files = ruff_arguments.filter((argument) => argument.startsWith(`${PROJECT_ROOT}/`));

		expect({
			labels: ruff_checks.map((check) => check.label),
			commands: ruff_checks.map((check) => check.command),
			rules: {
				isolated: ruff_arguments.includes("--isolated"),
				all: ruff_arguments.includes("ALL"),
				arguments: ruff_arguments.includes("ARG"),
				conflicting_rules: conflicting_rule_ids.every((rule_id) => ignored_rules.includes(rule_id)),
				test_private_access_ignore: private_member_ignore > 0,
			},
			all_paths_are_absolute: files.every((file) => file.startsWith(`${PROJECT_ROOT}/`)),
			ignored_files_excluded: files.every((file) => !file.includes("/.ai-code-guard/")),
			checks_performance_sources: files.some((file) => file.endsWith("/performance/cli.py")),
			checks_python_tests: files.some((file) => file.endsWith("/tests/python-bridge/test_python_bridge_entrypoint.py")),
			supports_review_options: ruff_checks.map((check) => check.supports_review_options),
		}).toEqual({
			labels: ["Ruff Python linting"],
			commands: ["python3"],
			rules: {
				isolated: true,
				all: true,
				arguments: true,
				conflicting_rules: true,
				test_private_access_ignore: true,
			},
			all_paths_are_absolute: true,
			ignored_files_excluded: true,
			checks_performance_sources: true,
			checks_python_tests: true,
			supports_review_options: [false],
		});
	});

	test("runs all Biome rules including nursery across TypeScript sources and tests", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const check = definitions.type_script_checks().find((item) => item.label === "TypeScript linting");
		assert.ok(check);

		expect({
			command: check.command,
			lint_command: check.args.slice(2, 8),
			paths: check.args.slice(8),
		}).toEqual({
			command: "pnpm",
			lint_command: [
				"exec",
				"biome",
				"lint",
				"--reporter=summary",
				"--max-diagnostics=none",
				`${PROJECT_ROOT}/documentation_validation`,
			],
			paths: [`${PROJECT_ROOT}/test-runner`, `${PROJECT_ROOT}/src`, `${PROJECT_ROOT}/tests`],
		});
	});

	test("automatically sorts TypeScript imports without running other Biome checks", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const check = definitions.type_script_checks().find((item) => item.label === "TypeScript import sorting");
		assert.ok(check);

		expect({
			command: check.command,
			arguments: check.args,
		}).toEqual({
			command: "pnpm",
			arguments: [
				"--dir",
				PROJECT_ROOT,
				"exec",
				"biome",
				"check",
				"--write",
				"--organize-imports-enabled=true",
				"--formatter-enabled=false",
				"--linter-enabled=false",
				`${PROJECT_ROOT}/documentation_validation`,
				`${PROJECT_ROOT}/test-runner`,
				`${PROJECT_ROOT}/src`,
				`${PROJECT_ROOT}/tests`,
			],
		});
	});

	test("formats all TypeScript source and test directories", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const formatting = definitions.type_script_checks().find((check) => check.label === "TypeScript formatting");
		assert.ok(formatting);

		expect(formatting.args).toEqual([
			"--dir",
			PROJECT_ROOT,
			"exec",
			"biome",
			"format",
			"--write",
			`${PROJECT_ROOT}/documentation_validation`,
			`${PROJECT_ROOT}/test-runner`,
			`${PROJECT_ROOT}/src`,
			`${PROJECT_ROOT}/tests`,
		]);
	});

	test("formats every project Python source with the shared line width", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const black = checks.find((check) => check.label === "Python formatting");
		assert.ok(black);

		expect({
			command: black.command,
			line_width: black.args.slice(2, 4),
			all_paths_absolute: black.args.slice(4).every((file) => file.startsWith(`${PROJECT_ROOT}/`)),
			includes_performance: black.args.includes(`${PROJECT_ROOT}/performance/cli.py`),
		}).toEqual({
			command: "python3",
			line_width: ["--line-length", "120"],
			all_paths_absolute: true,
			includes_performance: true,
		});
	});

	test("checks nested Python files with project-root paths", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const checks = definitions.python_checks();
		const pyflakes = checks.find((check) => check.label === "Python unused imports and names");
		const vulture = checks.find((check) => check.label === "Python unused functions and classes");
		assert.ok(pyflakes);
		assert.ok(vulture);

		expect({
			pyflakes_paths: pyflakes.args.slice(2).every((file) => file.startsWith(`${PROJECT_ROOT}/`)),
			pyflakes_nested_file: pyflakes.args.includes(
				`${PROJECT_ROOT}/src/python-bridge/implementation/ast/python_ast_bridge.py`,
			),
			pyflakes_checks_performance: pyflakes.args.includes(`${PROJECT_ROOT}/performance/cli.py`),
			pyflakes_checks_tests: pyflakes.args.includes(
				`${PROJECT_ROOT}/tests/python-bridge/test_python_bridge_entrypoint.py`,
			),
			vulture_checks_tests: vulture.args.includes(
				`${PROJECT_ROOT}/tests/python-bridge/test_python_bridge_entrypoint.py`,
			),
		}).toEqual({
			pyflakes_paths: true,
			pyflakes_nested_file: true,
			pyflakes_checks_performance: true,
			pyflakes_checks_tests: true,
			vulture_checks_tests: true,
		});
	});

	test("passes project and test support roots to all-project Python type checking", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const mypy = definitions.python_checks().find((check) => check.label === "Python type checking");
		assert.ok(mypy);
		const configured_mypy_paths = process.env[MYPYPATH_VARIABLE];
		let inherited_mypy_paths: string[] = [];
		if (configured_mypy_paths !== undefined) {
			inherited_mypy_paths = configured_mypy_paths.split(delimiter).filter(Boolean);
		}
		const expected_mypy_path_parts = [
			...inherited_mypy_paths,
			join(PROJECT_ROOT, "src/python-bridge"),
			join(PROJECT_ROOT, "tests/python-bridge"),
		];
		const expected_mypy_path = expected_mypy_path_parts.join(delimiter);

		expect(mypy.environment[MYPYPATH_VARIABLE]).toBe(expected_mypy_path);
	});

	test("uses the project root for the lint command", () => {
		const definitions = new QualityCheckDefinitions(PROJECT_ROOT);
		const lint = definitions.repository_checks().find((check) => check.label === "Coding lint");
		assert.ok(lint);
		expect(lint.args.slice(0, 2)).toEqual(["--dir", PROJECT_ROOT]);
		expect(lint).toEqual(
			expect.objectContaining({
				args: ["--dir", PROJECT_ROOT, "lint", "--", "--ignore-dir", ".codex"],
				supports_review_options: true,
				supports_review_agent: true,
			}),
		);
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
});
