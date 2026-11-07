import { describe, expect, test } from "@jest/globals";
import { TypeScriptSourceFiles } from "src/core/context/type_script_source_files";

describe("TypeScript source file collection", () => {
	test("parses TypeScript module kinds and TSX inputs with their proper script kinds", () => {
		const files = new TypeScriptSourceFiles(
			["src/main.ts", "src/view.tsx", "src/worker.mts", "src/worker.cts"],
			new Map([
				["src/main.ts", "export const main = 1;"],
				["src/view.tsx", "export const view = <section />;"],
				["src/worker.mts", "export const worker = 1;"],
				["src/worker.cts", "export const worker = 1;"],
			]),
		);
		const source_files = files.source_files();
		const source_entries = [...source_files];
		const parsed_statements = source_entries.map(([path, source]) => [path, source.statements.length]);
		expect(parsed_statements).toEqual([
			["src/main.ts", 1],
			["src/view.tsx", 1],
			["src/worker.mts", 1],
			["src/worker.cts", 1],
		]);
	});

	test("omits paths with unsupported extensions", () => {
		const files = new TypeScriptSourceFiles(
			["src/main.ts", "src/data.json"],
			new Map([
				["src/main.ts", "export const main = 1;"],
				["src/data.json", "{}"],
			]),
		);
		expect([...files.source_files().keys()]).toEqual(["src/main.ts"]);
	});
});
