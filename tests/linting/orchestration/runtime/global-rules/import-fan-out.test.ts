import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { ImportFanOut } from "src/linting/orchestration/runtime/global-rules/import_fan_out";
import ts from "typescript";
import type { ViolationContract } from "src/protocols";

describe("import fan-out", () => {
	test("reports more than twenty unique module paths for both languages", () => {
		const source = Array.from({ length: 21 }, (_, index) => `import value_${index} from "./module_${index}";`).join(
			"\n",
		);
		const source_file = ts.createSourceFile("fanout.ts", source, ts.ScriptTarget.Latest, true);
		const ast_model = new AstModel();
		const python_ast = ast_model.empty_ast_file("python");
		python_ast.python_imports = Array.from({ length: 21 }, (_, index) => ({
			line: index + 1,
			kind: "from" as const,
			module: `module_${index}`,
			names: [{ name: `value_${index}`, alias: "" }],
		}));
		const fan_out = new ImportFanOut();
		const typescript_violations: ViolationContract[] = [];
		const python_violations: ViolationContract[] = [];
		fan_out.append_typescript(typescript_violations, "fanout.ts", source_file);
		fan_out.append_python(python_violations, "fanout.py", python_ast);

		expect({ typescript: typescript_violations.length, python: python_violations.length }).toEqual({
			typescript: 1,
			python: 1,
		});
	});

	test("allows twenty unique module paths", () => {
		const source = Array.from({ length: 20 }, (_, index) => `import value_${index} from "./module_${index}";`).join(
			"\n",
		);
		const source_file = ts.createSourceFile("fanout.ts", source, ts.ScriptTarget.Latest, true);
		const violations: ViolationContract[] = [];
		const fan_out = new ImportFanOut();
		fan_out.append_typescript(violations, "fanout.ts", source_file);

		expect(violations).toHaveLength(0);
	});

	test("counts multiple imported names from one path once", () => {
		const source_lines = [
			'import { first } from "./shared";',
			'import { second } from "./shared";',
			Array.from({ length: 19 }, (_, index) => `import value_${index} from "./module_${index}";`).join("\n"),
		];
		const source = source_lines.join("\n");
		const source_file = ts.createSourceFile("fanout.ts", source, ts.ScriptTarget.Latest, true);
		const violations: ViolationContract[] = [];
		const fan_out = new ImportFanOut();
		fan_out.append_typescript(violations, "fanout.ts", source_file);

		expect(violations).toHaveLength(0);
	});
});
