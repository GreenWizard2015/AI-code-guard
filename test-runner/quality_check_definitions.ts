import { readdirSync } from "node:fs";
import { delimiter, join } from "node:path";
import { DOCUMENTATION_VALIDATION_DIRECTORY, NODE_MODULES_DIRECTORY, TEST_RUNNER_DIRECTORY } from "src/constants";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { SourceText } from "src/io/source_text";
import { IGNORED_DIRECTORIES } from "src/rules/constants";
import type { QualityCheckCatalogContract } from "src/task_types";
import {
	MIN_CONFIDENCE_ARGUMENT,
	MYPYPATH_VARIABLE,
	PYTHON_BRIDGE_DIRECTORY,
	PYTHON_TEST_DIRECTORY,
	RUFF_CONFLICTING_RULES,
	RUFF_IGNORE_ARGUMENT,
	RUFF_ISOLATED_ARGUMENT,
	RUFF_LINE_LENGTH_CONFIGURATION,
	RUFF_PER_FILE_IGNORE_ARGUMENT,
	RUFF_SELECT_ARGUMENT,
	RUFF_TEST_PRIVATE_MEMBER_ACCESS_IGNORES,
	TESTS_DIRECTORY,
} from "test-runner/constants";
import type { PythonUnusedChecks, QualityCheck } from "test-runner/types";
import type { ProjectPythonSourceFilePaths } from "test-runner/types";

/** Responsibilities: _quality check definition_, _language-specific check configuration_. **/
export class QualityCheckDefinitions implements QualityCheckCatalogContract {
	private readonly _project_root: string;
	private readonly _project_python_files: ProjectPythonSourceFilePaths;
	private readonly _git_ignored_paths: GitIgnoredPaths;

	/** Responsibilities: _mypy search path configuration_. **/
	private configured_mypy_paths(): string[] {
		const configured_path = process.env[MYPYPATH_VARIABLE];
		if (configured_path === undefined) {
			return [];
		}
		return configured_path.split(delimiter);
	}

	/** Responsibilities: _recursive Python files collection_. **/
	private python_files_in(directory: string): string[] {
		const files: string[] = [];
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (entry.name === ".codex" || IGNORED_DIRECTORIES.has(entry.name)) {
					continue;
				}
				files.push(...this.python_files_in(join(directory, entry.name)));
				continue;
			}
			if (entry.isFile() && entry.name.endsWith(".py")) {
				files.push(join(directory, entry.name));
			}
		}
		return files;
	}

	/** Responsibilities: _TypeScript quality-check files collection_. **/
	private type_script_files(): string[] {
		return [
			join(this._project_root, DOCUMENTATION_VALIDATION_DIRECTORY),
			join(this._project_root, TEST_RUNNER_DIRECTORY),
			join(this._project_root, "src"),
			join(this._project_root, TESTS_DIRECTORY),
		];
	}

	/** Responsibilities: _define Python formatting checks_. **/
	private python_formatting_checks(): QualityCheck {
		return {
			label: "Python formatting",
			command: "python3",
			args: ["-m", "black", "--line-length", "120", ...this._project_python_files],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		};
	}

	/** Responsibilities: _Python unused-symbol checks_. **/
	private python_unused_checks(): PythonUnusedChecks {
		const unused_imports: QualityCheck = {
			label: "Python unused imports and names",
			command: "python3",
			args: ["-m", "pyflakes", ...this._project_python_files],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		};
		const unused_declarations: QualityCheck = {
			label: "Python unused functions and classes",
			command: "vulture",
			args: [...this._project_python_files, "--exclude", NODE_MODULES_DIRECTORY, MIN_CONFIDENCE_ARGUMENT, "80"],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		};
		return { imports: unused_imports, declarations: unused_declarations };
	}

	/** Responsibilities: _define Python type checks_. **/
	private python_type_check(): QualityCheck {
		const bridge_directory = join(this._project_root, PYTHON_BRIDGE_DIRECTORY);
		const test_support_directory = join(this._project_root, PYTHON_TEST_DIRECTORY);
		const configured_mypy_path = this.configured_mypy_paths();
		const mypy_path_entries = configured_mypy_path.filter(Boolean);
		mypy_path_entries.push(bridge_directory, test_support_directory);
		const mypy_path = mypy_path_entries.join(delimiter);
		return {
			label: "Python type checking",
			command: "python3",
			args: [
				"-m",
				"mypy",
				"--strict",
				"--extra-checks",
				"--warn-unreachable",
				"--explicit-package-bases",
				...this._project_python_files,
			],
			environment: { ...process.env, MYPYPATH: mypy_path },
			supports_review_options: false,
			supports_review_agent: false,
		};
	}

	/** Responsibilities: _define Ruff Python checks_. **/
	private python_ruff_check(): QualityCheck {
		return {
			label: "Ruff Python linting",
			command: "python3",
			args: [
				"-m",
				"ruff",
				"check",
				RUFF_ISOLATED_ARGUMENT,
				"--config",
				RUFF_LINE_LENGTH_CONFIGURATION,
				RUFF_SELECT_ARGUMENT,
				"ALL",
				"--extend-select",
				"ARG",
				RUFF_IGNORE_ARGUMENT,
				RUFF_CONFLICTING_RULES,
				RUFF_PER_FILE_IGNORE_ARGUMENT,
				RUFF_TEST_PRIVATE_MEMBER_ACCESS_IGNORES,
				...this._project_python_files,
			],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		};
	}

	/** Responsibilities: _TypeScript lint check_. **/
	private typescript_lint(): QualityCheck {
		return {
			label: "TypeScript linting",
			command: "pnpm",
			args: [
				"--dir",
				this._project_root,
				"exec",
				"biome",
				"lint",
				"--reporter=summary",
				"--max-diagnostics=none",
				join(this._project_root, DOCUMENTATION_VALIDATION_DIRECTORY),
				join(this._project_root, TEST_RUNNER_DIRECTORY),
				join(this._project_root, "src"),
				join(this._project_root, "tests"),
			],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		};
	}

	/** Responsibilities: _TypeScript import-sorting check definition_. **/
	private typescript_import_sorting(): QualityCheck {
		const files = this.type_script_files();
		return {
			label: "TypeScript import sorting",
			command: "pnpm",
			args: [
				"--dir",
				this._project_root,
				"exec",
				"biome",
				"check",
				"--write",
				"--organize-imports-enabled=true",
				"--formatter-enabled=false",
				"--linter-enabled=false",
				...files,
			],
			environment: process.env,
			supports_review_options: false,
			supports_review_agent: false,
		};
	}

	/** Responsibilities: _quality-check definitions initialization_. **/
	public constructor(project_root: string) {
		this._project_root = project_root;
		this._git_ignored_paths = new GitIgnoredPaths(project_root, new SourceText());
		this._project_python_files = this._git_ignored_paths.filter(this.python_files_in(project_root)).sort();
	}

	/** Responsibilities: _TypeScript quality checks exposure_. **/
	public type_script_checks(): QualityCheck[] {
		const files = this.type_script_files();
		return [
			this.typescript_import_sorting(),
			{
				label: "TypeScript formatting",
				command: "pnpm",
				args: ["--dir", this._project_root, "exec", "biome", "format", "--write", ...files],
				environment: process.env,
				supports_review_options: false,
				supports_review_agent: false,
			},
			{
				label: "TypeScript types and unused declarations",
				command: "pnpm",
				args: ["--dir", this._project_root, "exec", "tsc", "--noEmit"],
				environment: process.env,
				supports_review_options: false,
				supports_review_agent: false,
			},
			this.typescript_lint(),
		];
	}

	/** Responsibilities: _Python quality checks exposure_. **/
	public python_checks(): QualityCheck[] {
		const unused_checks = this.python_unused_checks();
		return [
			this.python_formatting_checks(),
			this.python_ruff_check(),
			unused_checks.imports,
			this.python_type_check(),
			unused_checks.declarations,
		];
	}

	/** Responsibilities: _repository quality checks exposure_. **/
	public repository_checks(): QualityCheck[] {
		return [
			{
				label: "Coding lint",
				command: "pnpm",
				args: ["--dir", this._project_root, "lint", "--", "--ignore-dir", ".codex"],
				environment: process.env,
				supports_review_options: true,
				supports_review_agent: true,
			},
			{
				label: "Rule documentation validation",
				command: "pnpm",
				args: ["--dir", this._project_root, "validate:rule-docs"],
				environment: process.env,
				supports_review_options: false,
				supports_review_agent: false,
			},
		];
	}

	/** Responsibilities: _all quality checks exposure_. **/
	public all_checks(): QualityCheck[] {
		const type_script_checks = this.type_script_checks();
		const python_checks = this.python_checks();
		const repository_checks = this.repository_checks();
		return [...type_script_checks, ...python_checks, ...repository_checks];
	}
}
