import { describe, expect, test } from "@jest/globals";
import { DocumentationExampleGroup } from "documentation_validation/documentation_example_group";
import { DocumentationLanguage, ExampleKind } from "documentation_validation/types";
import type { DocumentationExample, RuleDocumentationDocument } from "documentation_validation/types";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { DocumentationExampleExecutorProbe } from "tests/documentation_validation/documentation_example_executor_probe";

describe("shared rule documentation", () => {
	test("accepts language-specific examples in one shared document", () => {
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, configuration);
		const examples: DocumentationExample[] = [
			{
				rule_id: "directory-max-source-subdirectories",
				language: DocumentationLanguage.TYPESCRIPT,
				kind: ExampleKind.BAD,
				index: 0,
				text: "",
				source_files: [],
			},
			{
				rule_id: "directory-max-source-subdirectories",
				language: DocumentationLanguage.PYTHON,
				kind: ExampleKind.BAD,
				index: 0,
				text: "",
				source_files: [],
			},
		];
		const document: RuleDocumentationDocument = {
			rule_id: "directory-max-source-subdirectories",
			file_path: "docs/rules/directory-max-source-subdirectories.md",
			text: "",
			line_count: 0,
			languages: [],
			examples: new Map([[ExampleKind.BAD, examples]]),
		};
		const group = new DocumentationExampleGroup(
			document,
			ExampleKind.BAD,
			examples,
			lint_runner,
			new DocumentationExampleExecutorProbe({ stdout: "", exit_code: 0 }),
		);

		expect(group.languages()).toEqual([DocumentationLanguage.TYPESCRIPT, DocumentationLanguage.PYTHON]);
		expect(group.conflicts()).toEqual([]);
	});

	test("rejects an example in the wrong language-specific document", () => {
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const lint_runner = new DocumentationValidationSession(configuration, configuration);
		const example: DocumentationExample = {
			rule_id: "typescript-console-in-test",
			language: DocumentationLanguage.PYTHON,
			kind: ExampleKind.BAD,
			index: 0,
			text: "",
			source_files: [],
		};
		const document: RuleDocumentationDocument = {
			rule_id: "typescript-console-in-test",
			file_path: "docs/rules/typescript/console-in-test.md",
			text: "",
			line_count: 0,
			languages: [DocumentationLanguage.TYPESCRIPT],
			examples: new Map([[ExampleKind.BAD, [example]]]),
		};
		const group = new DocumentationExampleGroup(
			document,
			ExampleKind.BAD,
			[example],
			lint_runner,
			new DocumentationExampleExecutorProbe({ stdout: "", exit_code: 0 }),
		);

		const conflicts = group.conflicts();
		expect(conflicts.map((conflict) => conflict.passed)).toEqual([false]);
	});
});
