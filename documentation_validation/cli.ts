#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { RULE_DATA } from "src/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";

(async function run_cli(): Promise<void> {
	const command_directory = dirname(fileURLToPath(import.meta.url));
	const project_root = resolve(command_directory, "..");
	const requested_arguments = process.argv.slice(2);
	if (requested_arguments.includes("--help")) {
		const help_lines = [
			"Usage: pnpm validate:rule-docs [rule-id ...]",
			"Options:",
			"  --help       Show this help",
			"  --list-rules Show registered rule ids",
		];
		process.stdout.write(`${help_lines.join("\n")}\n`);
		return;
	}
	if (requested_arguments.includes("--list-rules")) {
		const rule_ids = Object.keys(RULE_DATA);
		rule_ids.sort();
		process.stdout.write(`${rule_ids.join("\n")}\n`);
		return;
	}
	const sandbox = new DocumentationExampleSandbox(spawnSync);
	const source_text = new SourceText();
	const file_io = new NodeFileIO(project_root);
	const configuration = new LintRunConfiguration(source_text, file_io);
	const session = new DocumentationValidationSession(configuration, configuration);
	const validation = new CliDocumentationValidation(project_root, session.rule_ids(), session, sandbox, source_text);
	const status = await validation.run(requested_arguments);
	process.exit(status);
})();
