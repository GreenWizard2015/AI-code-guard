import { spawnSync } from "node:child_process";
import { QualityCheckDefinitions } from "test-runner/quality-check-definitions";
import type { QualityCheck } from "test-runner/types";

/** Responsibilities: _execution configuration quality commands_. **/
export class QualityCheckProcess {
	private readonly definitions: QualityCheckDefinitions;
	private readonly check_items: readonly QualityCheck[];

	/** Responsibilities: _terminate process quality command_. **/
	private assert_success(status: number): void {
		if (status !== 0) {
			let exit_status = status;
			if (exit_status === null) {
				exit_status = 1;
			}
			process.exit(exit_status);
		}
	}

	/** Responsibilities: _execution configuration quality command_. **/
	private run_command(check: QualityCheck, skip_review: boolean): void {
		process.stdout.write(`🔎 Checking ${check.label}...\n`);
		let args = check.args;
		if (skip_review) {
			if (check.supports_skip_review === true) {
				args = [...check.args, "--", "--skip-review"];
			}
		}
		const result = spawnSync(check.command, [...args], {
			env: check.environment,
			stdio: "inherit",
			shell: false,
		});
		this.assert_command(check.command, result);
	}

	/** Responsibilities: _validation result quality command_. **/
	private assert_command(command: string, result: ReturnType<typeof spawnSync>): void {
		let status = 1;
		if (result.status !== null) {
			status = result.status;
		}
		if (result.error === undefined) {
			this.assert_success(status);
			return;
		}
		process.stderr.write(`Failed to start ${command}: ${result.error.message}\n`);
		process.exit(1);
	}

	/** Responsibilities: _initialization project root quality_. **/
	constructor(project_root: string) {
		this.definitions = new QualityCheckDefinitions(project_root);
		this.check_items = this.definitions.all_checks();
	}

	/** Responsibilities: _execution available quality checks_. **/
	public run(skip_review: boolean): void {
		for (const check of this.check_items) {
			this.run_command(check, skip_review);
		}
	}

	/** Responsibilities: _reporting least quality check_. **/
	public available_checks(): boolean {
		return this.check_items.length > 0;
	}
}
