import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { QualityCheck } from "tests/core/types";

/** Responsibilities: _define repository quality checks_. **/
export class QualityCheckDefinitions {
	private readonly project_root: string;

	/** Responsibilities: _Python bridge files collection_. **/
	private python_files(): string[] {
		const bridge_directory = join(
			this.project_root,
			"src/parser/python-bridge",
		);
		const bridge_files = readdirSync(bridge_directory)
			.filter((file) => file.endsWith(".py"))
			.map((file) => join(bridge_directory, file));
		return bridge_files.sort();
	}

	/** Responsibilities: _TypeScript quality-check files collection_. **/
	private type_script_files(): string[] {
		return [
			join(this.project_root, "test-runner.ts"),
			join(this.project_root, "tests/core/test-runner.ts"),
			join(this.project_root, "tests/core/quality-checks.ts"),
			join(this.project_root, "tests/core/quality-check-definitions.ts"),
			join(this.project_root, "src/bridge/ts/core/cli.ts"),
		];
	}

	/** Responsibilities: _define Python formatting checks_. **/
	private python_formatting_checks(directory: string): QualityCheck {
		return {
			label: "Python formatting",
			command: "python3",
			args: ["-m", "black", directory],
			environment: process.env,
		};
	}

	/** Responsibilities: _define Python unused-name checks_. **/
	private python_unused_check(files: string[]): QualityCheck {
		return {
			label: "Python unused imports and names",
			command: "python3",
			args: ["-m", "pyflakes", ...files],
			environment: process.env,
		};
	}

	/** Responsibilities: _define Python type checks_. **/
	private python_type_check(): QualityCheck {
		const bridge_directory = join(
			this.project_root,
			"src/parser/python-bridge",
		);
		return {
			label: "Python type checking",
			command: "python3",
			args: [
				"-m",
				"mypy",
				"--warn-unreachable",
				"--ignore-missing-imports",
				"--follow-imports=skip",
				"-m",
				"entrypoint",
			],
			environment: { ...process.env, MYPYPATH: bridge_directory },
		};
	}

	/** Responsibilities: _define Ruff Python checks_. **/
	private python_ruff_check(directory: string): QualityCheck {
		return {
			label: "Ruff Python linting",
			command: "python3",
			args: [
				"-m",
				"ruff",
				"check",
				"--isolated",
				"--select",
				"E4,E7,E9,F",
				directory,
			],
			environment: process.env,
		};
	}

	/** Responsibilities: _define Python unused-declaration checks_. **/
	private python_unused_checkers(files: string[]): QualityCheck {
		return {
			label: "Python unused functions and classes",
			command: "vulture",
			args: [
				...files,
				join(this.project_root, "tests"),
				"--exclude",
				"node_modules",
				"--min-confidence",
				"80",
			],
			environment: process.env,
		};
	}

	/** Responsibilities: _Python static checks assembly_. **/
	private python_static_checks(files: string[]): QualityCheck[] {
		return [
			this.python_unused_check(files),
			this.python_type_check(),
			this.python_unused_checkers(files),
		];
	}

	/** Responsibilities: _quality-check definitions initialization_. **/
	constructor(project_root: string) {
		this.project_root = project_root;
	}

	/** Responsibilities: _TypeScript quality checks exposure_. **/
	public type_script_checks(): QualityCheck[] {
		const files = this.type_script_files();
		return [
			{
				label: "TypeScript formatting",
				command: "pnpm",
				args: [
					"--dir",
					this.project_root,
					"exec",
					"biome",
					"format",
					"--write",
					...files,
				],
				environment: process.env,
			},
			{
				label: "TypeScript types and unused declarations",
				command: "pnpm",
				args: ["--dir", this.project_root, "exec", "tsc", "--noEmit"],
				environment: process.env,
			},
		];
	}

	/** Responsibilities: _Python quality checks exposure_. **/
	public python_checks(): QualityCheck[] {
		const files = this.python_files();
		const directory = join(this.project_root, "src/parser/python-bridge");
		return [
			this.python_formatting_checks(directory),
			this.python_ruff_check(directory),
			...this.python_static_checks(files),
		];
	}

	/** Responsibilities: _repository quality checks exposure_. **/
	public repository_checks(): QualityCheck[] {
		return [
			{
				label: "Coding lint",
				command: "pnpm",
				args: [
					"--dir",
					this.project_root,
					"lint",
					"--",
					"--policy",
					"all",
					"--batch-size",
					"1000000",
				],
				environment: process.env,
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
