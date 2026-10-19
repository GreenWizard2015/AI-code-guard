#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { SourceText } from "src/source_text";

(function run_cli(): void {
	const command_directory = dirname(fileURLToPath(import.meta.url));
	const project_root = resolve(command_directory, "..");
	const session = new DocumentationValidationSession();
	const validation = new CliDocumentationValidation(project_root, session.rule_ids(), session, new SourceText());
	process.exitCode = validation.run(process.argv.slice(2));
})();
