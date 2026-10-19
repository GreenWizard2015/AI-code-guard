import { describe, expect, test } from "@jest/globals";
import { ContextSourceRecordCacheIdentity } from "src/core/context/context_source_record_cache_identity";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("TypeScript source-record cache configuration identity", () => {
	test("changes identity when a project alias changes", () => {
		const root = "/virtual/source-record-cache";
		const caller_file = `${root}/caller.ts`;
		const caller_text = 'import { value } from "alias/module"; value();\n';
		const source_texts = new Map([[caller_file, caller_text]]);
		const first_source_io = new InMemoryProjectSourceIO(
			new Map([
				[
					`${root}/tsconfig.json`,
					JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "alias/*": ["first/*"] } } }),
				],
				[caller_file, caller_text],
			]),
		);
		const changed_source_io = new InMemoryProjectSourceIO(
			new Map([
				[
					`${root}/tsconfig.json`,
					JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "alias/*": ["second/*"] } } }),
				],
				[caller_file, caller_text],
			]),
		);
		const first = new ContextSourceRecordCacheIdentity(root, [caller_file], source_texts, first_source_io);
		const changed = new ContextSourceRecordCacheIdentity(root, [caller_file], source_texts, changed_source_io);

		expect(changed.cache_identity()).not.toBe(first.cache_identity());
	});

	test("keeps identity stable while project configuration stays unchanged", () => {
		const root = "/virtual/source-record-cache";
		const caller_file = `${root}/caller.ts`;
		const caller_text = 'import { value } from "alias/module"; value();\n';
		const source_texts = new Map([[caller_file, caller_text]]);
		/** Responsibilities: _stable project source setup_. **/
		const create_source_io = (): InMemoryProjectSourceIO =>
			new InMemoryProjectSourceIO(
				new Map([
					[
						`${root}/tsconfig.json`,
						JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "alias/*": ["first/*"] } } }),
					],
					[caller_file, caller_text],
				]),
			);
		const first = new ContextSourceRecordCacheIdentity(root, [caller_file], source_texts, create_source_io());
		const second = new ContextSourceRecordCacheIdentity(root, [caller_file], source_texts, create_source_io());

		expect(second.cache_identity()).toBe(first.cache_identity());
	});
});
