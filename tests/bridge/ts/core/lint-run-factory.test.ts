import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/bridge/ts/core/lint-run-factory";
import { LintStageTimer } from "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";

describe("lint run ignored directories", () => {
	const fixture = new TestFixture();

	/** Responsibilities: _execution callback lint-file override_. **/
	const without_lint_file_override = <T>(callback: () => T): T => {
		const original = process.env.CODING_LINT_FILES;
		delete process.env.CODING_LINT_FILES;
		try {
			return callback();
		} finally {
			if (original === undefined) {
				delete process.env.CODING_LINT_FILES;
			} else {
				process.env.CODING_LINT_FILES = original;
			}
		}
	};

	/** Responsibilities: _execution callback configuration lint_. **/
	const with_factory = <T>(callback: (factory: LintRunConfiguration) => T): T => {
		const factory = new LintRunConfiguration();
		try {
			return callback(factory);
		} finally {
			factory.python_ast_worker.close();
		}
	};

	test("does not return ignored files as lint targets", () => {
		const files = fixture.with_temporary_files(
			"webmcp-lint-ignored-target-",
			{
				"kept.ts": "export const kept = 1;\n",
				"ignored/ignored.ts": "export const ignored = 1;\n",
			},
			(root) => without_lint_file_override(() => with_factory((factory) => factory.target_files(root, ["ignored"]))),
		);

		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/\/kept\.ts$/u);
	});

	test("does not load ignored files into project context", () => {
		const context_files = fixture.with_temporary_files(
			"webmcp-lint-ignored-context-",
			{
				"kept.ts": "export const kept = 1;\n",
				"ignored/ignored.ts": "export const ignored = 1;\n",
			},
			(root) =>
				without_lint_file_override(() =>
					with_factory((factory) => {
						const report = factory.lint_report(root, ["ignored"], new LintStageTimer());
						return report.context.files().map((file) => file.absolute_path);
					}),
				),
		);

		expect(context_files).toHaveLength(1);
		expect(context_files[0]).toMatch(/\/kept\.ts$/u);
	});

	test("rejects type declarations in root functions files", () => {
		const messages = fixture.with_temporary_files(
			"webmcp-functions-types-",
			{
				"functions.ts": ["type Value = string;", "interface Port {}", "enum State { Ready }", "class Owner {}"].join(
					"\n",
				),
			},
			(root) =>
				without_lint_file_override(() =>
					with_factory((factory) => {
						const report = factory.lint_report(root, [], new LintStageTimer());
						return report.report.violations
							.filter((item) => item.rule_id === "functions-file-type-declaration")
							.map((item) => item.file);
					}),
				),
		);

		expect(messages).toEqual(["functions.ts", "functions.ts", "functions.ts", "functions.ts"]);
	});

	test("rejects qualified and imported type aliases in functions.py", () => {
		const messages = fixture.with_temporary_files(
			"webmcp-functions-python-types-",
			{
				"functions.py": [
					"from typing import TypeAlias",
					"from typing import TypeAlias as TypeAliasMarker",
					"import typing",
					"Value: TypeAlias = str",
					"Qualified: typing.TypeAlias = str",
					"Imported: TypeAliasMarker = str",
					"class Owner:",
					"    pass",
				].join("\n"),
			},
			(root) =>
				without_lint_file_override(() =>
					with_factory((factory) => {
						const report = factory.lint_report(root, [], new LintStageTimer());
						return report.report.violations
							.filter((item) => item.rule_id === "functions-file-type-declaration")
							.map((item) => item.file);
					}),
				),
		);

		expect(messages).toHaveLength(4);
		expect(new Set(messages)).toEqual(new Set(["functions.py"]));
	});

	test("rejects assigned TypeAlias and TypeAliasType factories", () => {
		const messages = fixture.with_temporary_files(
			"webmcp-functions-python-aliases-",
			{
				"functions.py": [
					"from typing import TypeAlias",
					"from typing_extensions import TypeAliasType",
					"ALIAS = TypeAlias",
					"Assigned: ALIAS = str",
					'UserId = TypeAliasType("UserId", int)',
					'[user_id] = [TypeAliasType("UserId", int)]',
					'annotated_user_id: TypeAliasType = TypeAliasType("UserId", int)',
					"class Owner:",
					"    pass",
				].join("\n"),
			},
			(root) =>
				without_lint_file_override(() =>
					with_factory((factory) => {
						const report = factory.lint_report(root, [], new LintStageTimer());
						return report.report.violations
							.filter((item) => item.rule_id === "functions-file-type-declaration")
							.map((item) => item.file);
					}),
				),
		);

		expect(messages).toHaveLength(6);
		expect(new Set(messages)).toEqual(new Set(["functions.py"]));
	});
});
