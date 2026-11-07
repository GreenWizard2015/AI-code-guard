import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript project composition AST verifier", () => {
	test("reports excessive composition depth through the source-file verifier", () => {
		const fixture = new TestFixture();
		const files = {
			"src/a.ts": 'import { B } from "./b"; export class A { private readonly b = new B(); }',
			"src/b.ts": 'import { C } from "./c"; export class B { private readonly c = new C(); }',
			"src/c.ts": 'import { D } from "./d"; export class C { private readonly d = new D(); }',
			"src/d.ts": 'import { E } from "./e"; export class D { private readonly e = new E(); }',
			"src/e.ts": "export class E {}",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(configuration, options, mode) => configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((violation) => violation.rule_id() === "composition-depth").length).toBeGreaterThan(0);
	});

	test("does not use test-only composition chains as production findings", () => {
		const fixture = new TestFixture();
		const files = {
			"tests/a.test.ts": 'import { B } from "./b.test"; export class A { private readonly b = new B(); }',
			"tests/b.test.ts": 'import { C } from "./c.test"; export class B { private readonly c = new C(); }',
			"tests/c.test.ts": 'import { D } from "./d.test"; export class C { private readonly d = new D(); }',
			"tests/d.test.ts": 'import { E } from "./e.test"; export class D { private readonly e = new E(); }',
			"tests/e.test.ts": "export class E {}",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(configuration, options, mode) => configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((violation) => violation.rule_id() === "composition-depth")).toEqual([]);
	});
});
