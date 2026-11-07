import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("class state ownership", () => {
	test("recognizes mutation through readonly collection fields as state", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/cache.ts": [
				"class Cache {",
				"  private readonly entries: Map<string, number> = new Map();",
				"  public add(key: string, value: number): void { this.entries.set(key, value); }",
				"}",
			].join("\n"),
			"src/view.ts": [
				"class View {",
				'  private readonly names: ReadonlySet<string> = new Set(["name"]);',
				"  public has(name: string): boolean { return this.names.has(name); }",
				"}",
			].join("\n"),
			"src/index.ts": [
				"class Index {",
				"  private readonly entries: Map<string, number> = new Map();",
				"  private add_entry(entries: Map<string, number>, key: string, value: number): void { entries.set(key, value); }",
				"  public add(key: string, value: number): void { this.add_entry(this.entries, key, value); }",
				"}",
			].join("\n"),
			"src/session.ts": [
				"class Session {",
				"  private readonly owner: { worker: { close(): void } } = { worker: { close() {} } };",
				"  public finish(): void { this.owner.worker.close(); }",
				"}",
			].join("\n"),
			"src/delegated_cache.ts": [
				"class CacheWriter {",
				"  public constructor(private readonly entries: Map<string, number>) {}",
				"}",
				"class DelegatedCache {",
				"  private readonly entries: Map<string, number> = new Map();",
				"  public writer(): CacheWriter { return new CacheWriter(this.entries); }",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const stateless_classes = violations
			.filter((item) => item.rule_id() === "stateless-class")
			.map((item) => ({ file: item.file(), line: item.line() }));

		expect({
			view: stateless_classes.some((item) => item.file === "src/view.ts"),
			cache: stateless_classes.some((item) => item.file === "src/cache.ts"),
			index: stateless_classes.some((item) => item.file === "src/index.ts"),
			session: stateless_classes.some((item) => item.file === "src/session.ts"),
			delegated_cache_writer: stateless_classes.some(
				(item) => item.file === "src/delegated_cache.ts" && item.line === 1,
			),
			delegated_cache_owner: stateless_classes.some(
				(item) => item.file === "src/delegated_cache.ts" && item.line === 4,
			),
		}).toEqual({
			view: true,
			cache: false,
			index: false,
			session: false,
			delegated_cache_writer: true,
			delegated_cache_owner: false,
		});
	});

	test("counts constructor-injected adapters as state and reports stateless contract helpers", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/file_source.ts": [
				"interface FileSystemContract { read(path: string): string; }",
				"interface FileSourceContract { read(path: string): string; }",
				"class FileSource implements FileSourceContract {",
				"  private readonly file_system: FileSystemContract;",
				"  public constructor(file_system: FileSystemContract) { this.file_system = file_system; }",
				"  public read(path: string): string { return this.file_system.read(path); }",
				"}",
				"interface NodeRuleContract { active_for(source: string): boolean; verify(): void; }",
				"interface DiagnosticRuleContract { violation(): string; }",
				"class NodeRule implements NodeRuleContract {",
				"  private readonly diagnostic_rule: DiagnosticRuleContract;",
				"  public constructor(diagnostic_rule: DiagnosticRuleContract) { this.diagnostic_rule = diagnostic_rule; }",
				"  public active_for(source: string): boolean { return source.length > 0; }",
				"  public verify(): void { this.diagnostic_rule.violation(); }",
				"}",
				"interface ParserContract { parse(): boolean; }",
				"class Parser implements ParserContract {",
				"  public parse(): boolean { return true; }",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const stateless_classes = violations
			.filter((item) => item.rule_id() === "stateless-class")
			.map((item) => ({ file: item.file(), line: item.line() }))
			.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

		expect(stateless_classes).toEqual([]);
	});
});
