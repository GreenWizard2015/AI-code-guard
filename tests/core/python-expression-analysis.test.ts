import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language expression diagnostics", () => {
	test("reports error handling defects with source locations", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"empty-handler.ts": "try { run(); } catch {}\ntry { run(); } catch (error) { report(error); }",
				"empty-handler.py":
					"try:\n    run()\nexcept Exception:\n    pass\ntry:\n    run()\nexcept Exception as error:\n    report(error)",
				"context.ts": [
					"function translate(): void {",
					"\ttry { run(); } catch (error) { throw new RuntimeError('failed'); }",
					"}",
					"function translate_nested(): void {",
					"\ttry { run(); } catch (error) { if (failed()) { throw new RuntimeError('failed'); } }",
					"}",
					"function preserve(): void {",
					"\ttry { run(); } catch (error) { throw new RuntimeError(error.message); }",
					"}",
				].join("\n"),
				"context.py": [
					"def suppress() -> None:",
					"    try:",
					"        run()",
					"    except ValueError:",
					"        raise RuntimeError('failed') from None",
					"",
					"def preserve() -> None:",
					"    try:",
					"        run()",
					"    except ValueError as error:",
					"        raise RuntimeError(str(error))",
				].join("\n"),
				"coordinates.ts": [
					"function translate(): void {",
					"\ttry { run(); } catch (error) {",
					"\t\tthrow new RuntimeError('failed');",
					"\t}",
					"}",
					"try { run(); } catch {}",
				].join("\n"),
				"tests/coordinates.test.ts": [
					"describe('coordinates', () => {",
					"\ttest('reads time', () => {",
					"\t\tconst now = Date.now();",
					"\t\texpect(now).toBeDefined();",
					"\t});",
					"});",
				].join("\n"),
				"duplicate-error.ts": [
					"function translate(): void {",
					"    try { run(); } catch (error) {",
					"        if (failed()) { throw new RuntimeError('failed'); }",
					"        throw new RuntimeError('failed');",
					"    }",
					"}",
					"function distinct(): void {",
					"    try { run(); } catch (error) {",
					"        if (failed()) { throw new RuntimeError('failed'); }",
					"        throw new RuntimeError('cancelled');",
					"    }",
					"}",
				].join("\n"),
				"duplicate_error.py": [
					"def translate() -> None:",
					"    try:",
					"        run()",
					"    except ValueError:",
					"        if failed():",
					"            raise RuntimeError('failed')",
					"        raise RuntimeError('failed')",
					"",
					"def distinct() -> None:",
					"    try:",
					"        run()",
					"    except ValueError:",
					"        if failed():",
					"            raise RuntimeError('failed')",
					"        raise RuntimeError('cancelled')",
				].join("\n"),
				"tests/duplicate_error_test.py": [
					"def test_duplicate() -> None:",
					"    try:",
					"        run()",
					"    except ValueError:",
					"        raise RuntimeError('failed')",
					"        raise RuntimeError('failed')",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			empty_handlers: violations.filter((item) => item.rule_id === "empty-error-handler").length,
			lost_context: violations.filter((item) => item.rule_id === "error-context-loss").length,
			context_cases: violations.filter(
				(item) => item.rule_id === "error-context-loss" && (item.file === "context.ts" || item.file === "context.py"),
			).length,
			duplicate_translation_context: violations.filter(
				(item) =>
					item.rule_id === "error-context-loss" &&
					(item.file === "duplicate-error.ts" || item.file === "duplicate_error.py"),
			).length,
			duplicate_translation: violations.filter((item) => item.rule_id === "duplicate-error-translation").length,
			location_lines: {
				context: violations.find((item) => item.rule_id === "error-context-loss" && item.file === "coordinates.ts")
					?.line,
				empty_handler: violations.find(
					(item) => item.rule_id === "empty-error-handler" && item.file === "coordinates.ts",
				)?.line,
				time: violations.find((item) => item.rule_id === "test-time-dependency")?.line,
			},
		}).toEqual({
			empty_handlers: 3,
			lost_context: 8,
			context_cases: 3,
			duplicate_translation_context: 4,
			duplicate_translation: 2,
			location_lines: { context: 3, empty_handler: 6, time: 3 },
		});
	});

	test("reports incomplete async, retry, cache, and boolean contracts", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"async-completion.ts": [
					"async function load_result(): Promise<number> { return 1; }",
					"function production_call(): void { load_result(); }",
				].join("\n"),
				"tests/async_completion_test.py": [
					"import asyncio",
					"import unittest",
					"async def load_result() -> int:",
					"    return 1",
					"class TestAsync(unittest.TestCase):",
					"    def test_missing_completion(self) -> None:",
					"        load_result()",
					"        self.assertTrue(True)",
					"    def test_observed_completion(self) -> None:",
					"        asyncio.run(load_result())",
					"        self.assertTrue(True)",
				].join("\n"),
				"retry.ts": [
					"function retry_forever(): void {",
					"    while (true) {",
					"        try { request(); } catch (error) { continue; }",
					"    }",
					"}",
					"function retry_bounded(): void {",
					"    for (let attempt = 0; attempt < 3; attempt += 1) {",
					"        try { request(); } catch (error) { continue; }",
					"    }",
					"}",
				].join("\n"),
				"retry.py": [
					"def retry_forever() -> None:",
					"    while True:",
					"        try:",
					"            request()",
					"        except OSError:",
					"            continue",
					"",
					"def retry_bounded() -> None:",
					"    for attempt in range(3):",
					"        try:",
					"            request()",
					"        except OSError:",
					"            continue",
					"",
					"def retry_with_integer_literal() -> None:",
					"    while 1:",
					"        try:",
					"            request()",
					"        except OSError:",
					"            continue",
					"",
					"def retry_with_string_literal() -> None:",
					'    while "retry":',
					"        try:",
					"            request()",
					"        except OSError:",
					"            continue",
					"",
					"def retry_with_false_literal() -> None:",
					"    while 0:",
					"        try:",
					"            request()",
					"        except OSError:",
					"            continue",
				].join("\n"),
				"cache-key.ts": [
					"function load(file: string, text: string): Result {",
					"    const cached = cache.get(file);",
					"    cache.set(file + text, create_result());",
					"    return cached;",
					"}",
					"function valid(file: string): Result {",
					"    const cached = cache.get(file);",
					"    cache.set(file, create_result());",
					"    return cached;",
					"}",
				].join("\n"),
				"cache_key.py": [
					"def load(file: str, text: str) -> Result:",
					"    cached = cache.get(file)",
					"    cache.set(file + text, create_result())",
					"    return cached",
					"",
					"def valid(file: str) -> Result:",
					"    cached = cache.get(file)",
					"    cache.set(file, create_result())",
					"    return cached",
				].join("\n"),
				"literal-cache-key.ts": [
					"function load(): Result {",
					"\tconst cached = cache.get('a b');",
					"\tcache.set('ab', create_result());",
					"\treturn cached;",
					"}",
				].join("\n"),
				"nested_cache_key.py": [
					"def outer(file: str, text: str) -> None:",
					"    def inner() -> None:",
					"        cached = cache.get(file)",
					"        cache.set(file + text, create_result())",
					"        return None",
					"    inner()",
					"    return None",
				].join("\n"),
				"flags.ts": [
					"function configure(enabled: boolean, strict: boolean): void {}",
					"function check(enabled: boolean): boolean { return enabled; }",
				].join("\n"),
				"flags.py": [
					"def configure(enabled: bool, strict: bool) -> None:",
					"    return None",
					"",
					"def check(enabled: bool) -> bool:",
					"    return enabled",
				].join("\n"),
				"aliased-flags.py": [
					"ModeFlag = bool",
					"",
					"def publish(notify: ModeFlag, dry_run: ModeFlag) -> None:",
					"    return None",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			async_completion: violations.filter((item) => item.rule_id === "unasserted-async-completion").length,
			retry: violations.filter((item) => item.rule_id === "retry-without-ownership").length,
			cache_keys: violations.filter((item) => item.rule_id === "incomplete-cache-key").length,
			boolean_flags: violations.filter((item) => item.rule_id === "boolean-flag-parameter").length,
		}).toEqual({ async_completion: 1, retry: 4, cache_keys: 4, boolean_flags: 3 });
	});
});
