import { describe, expect, test } from "@jest/globals";
import { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";

describe("callable usage method-file index", () => {
	test("deduplicates and reuses protocol method candidate files", () => {
		const references = new CallableUsageReferences();
		for (const file of ["first.ts", "second.ts", "ignored.ts"]) {
			const owner = file === "ignored.ts" ? "ConcreteHelper" : "RunnerContract";
			const ast_file = new TypeScriptAstFile(file, `declare const runner: ${owner}; runner.run(); runner.run();`);
			references.append_file({
				file,
				absolute_file: file,
				imports: new Set(),
				ast: ast_file.normalized(),
				reference_aliases: [],
			});
		}
		const index = references.snapshot(new Set(["RunnerContract"])).contract_method_files;
		const first = index.get("run");
		const repeated = references.snapshot(new Set(["RunnerContract"])).contract_method_files.get("run");
		let first_files: string[] = [];
		if (first !== undefined) {
			first_files = first.map((file) => file.file);
		}

		expect({ files: first_files, reused: repeated === first }).toEqual({
			files: ["first.ts", "second.ts"],
			reused: true,
		});
	});

	test("rebuilds protocol method candidates when new source references arrive", () => {
		const references = new CallableUsageReferences();
		/** Responsibilities: _protocol owner source creation_. **/
		const append_runner = (file: string): void => {
			const source = "declare const runner: RunnerContract; runner.run();";
			const ast_file = new TypeScriptAstFile(file, source);
			references.append_file({
				file,
				absolute_file: file,
				imports: new Set(),
				ast: ast_file.normalized(),
				reference_aliases: [],
			});
		};
		append_runner("first.ts");
		const protocol_names = new Set(["RunnerContract"]);
		const previous = references.snapshot(protocol_names).contract_method_files.get("run");
		append_runner("next.ts");
		const next = references.snapshot(protocol_names).contract_method_files.get("run");
		let previous_files: string[] = [];
		if (previous !== undefined) {
			previous_files = previous.map((file) => file.file);
		}
		let next_files: string[] = [];
		if (next !== undefined) {
			next_files = next.map((file) => file.file);
		}

		expect({ previous: previous_files, next: next_files }).toEqual({
			previous: ["first.ts"],
			next: ["first.ts", "next.ts"],
		});
	});

	test("keeps candidates from different protocol owners separate", () => {
		const references = new CallableUsageReferences();
		for (const candidate of [
			{ file: "runner.ts", owner: "RunnerContract" },
			{ file: "writer.ts", owner: "WriterContract" },
		]) {
			const file = candidate.file;
			const ast_file = new TypeScriptAstFile(file, `declare const service: ${candidate.owner}; service.run();`);
			references.append_file({
				file,
				absolute_file: file,
				imports: new Set(),
				ast: ast_file.normalized(),
				reference_aliases: [],
			});
		}
		const runner_files = references.snapshot(new Set(["RunnerContract"])).contract_method_files.get("run");
		const writer_files = references.snapshot(new Set(["WriterContract"])).contract_method_files.get("run");
		let runner_names: string[] = [];
		let writer_names: string[] = [];
		if (runner_files !== undefined) {
			runner_names = runner_files.map((file) => file.file);
		}
		if (writer_files !== undefined) {
			writer_names = writer_files.map((file) => file.file);
		}

		expect({ runner_names, writer_names }).toEqual({ runner_names: ["runner.ts"], writer_names: ["writer.ts"] });
	});

	test("indexes same-name calls by resolved target file", () => {
		const references = new CallableUsageReferences();
		const ast_file = new TypeScriptAstFile("consumer.ts", "run();");
		const ast = ast_file.normalized();
		const target_files = ["first.ts", "second.ts", "third.ts"];
		const call_references = ast.references.call_references.flatMap((base_reference) =>
			target_files.map((target_file) => ({ ...base_reference, target_file })),
		);
		references.append_file({
			file: "consumer.ts",
			absolute_file: "consumer.ts",
			imports: new Set(),
			ast: { ...ast, references: { ...ast.references, call_references } },
			reference_aliases: [],
		});
		const groups = references.snapshot(new Set()).references_by_file.get("consumer.ts");
		const keys: string[] = [];
		if (groups !== undefined) {
			for (const key of groups.keys()) {
				keys.push(key);
			}
		}
		keys.sort();

		expect(keys).toEqual(["function:first.ts:run", "function:second.ts:run", "function:third.ts:run"]);
	});
});
