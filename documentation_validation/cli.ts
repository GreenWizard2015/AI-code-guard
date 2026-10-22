#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { CliDocumentationValidation } from "#documentation_validation/cli_documentation_validation";
import { SourceText } from "src/source_text";
import { RULE_DATA } from "src/constants";

(function run_cli(): void {
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
	const session = new DocumentationValidationSession();
	const source_text = new SourceText();
	const validation = new CliDocumentationValidation(project_root, session.rule_ids(), session, source_text);
	process.exitCode = validation.run(requested_arguments);
})();
