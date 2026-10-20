import { describe, expect, test } from "@jest/globals";
import { CallableSourceImportScope } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_source_import_scope";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { TestFixture } from "tests/core/test-fixture";

describe("callable source import scope", () => {
	const fixture = new TestFixture();

	test("reuses the prepared Python source record", () => {
		const actual = fixture.project_source.with_in_memory_project(
			{
				"pkg/service.py": "class Service:\n    pass\n",
				"pkg/consumer.py": "from pkg.service import Service\n\nclass Consumer:\n    pass\n",
			},
			(root, context, paths, source_texts) => {
				const consumer = `${root}/pkg/consumer.py`;
				source_texts.set(consumer, "class Consumer:\n    pass\n");
				const scanner = new ProjectSourceScanner(root, {
					context_state: { available: true, value: context },
					entry_files: [],
				});
				const scope = new CallableSourceImportScope(paths, scanner);
				return { root, imports: [...scope.imports_for(consumer)] };
			},
			new Map(),
		);
		expect(actual.imports).toEqual([`${actual.root}/pkg/service.py`]);
	});

	test("reuses the prepared TypeScript source record", () => {
		const actual = fixture.project_source.with_in_memory_project(
			{
				"service.ts": "export class Service {}\n",
				"consumer.ts": 'import { Service } from "./service";\nexport class Consumer {}\n',
			},
			(root, context, paths, source_texts) => {
				const consumer = `${root}/consumer.ts`;
				source_texts.set(consumer, "export class Consumer {}\n");
				const scanner = new ProjectSourceScanner(root, {
					context_state: { available: true, value: context },
					entry_files: [],
				});
				const scope = new CallableSourceImportScope(paths, scanner);
				return { root, imports: [...scope.imports_for(consumer)] };
			},
			new Map(),
		);
		expect(actual.imports).toEqual([`${actual.root}/service.ts`]);
	});
});
