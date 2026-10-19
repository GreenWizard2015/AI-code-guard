import { describe, expect, jest, test } from "@jest/globals";
import { ClassRules } from "src/rules/class_rules";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import type { ViolationContract } from "src/protocols";

describe("class summary AST reuse", () => {
	test("uses the prepared empty class result for a contract module", () => {
		const text = "export interface ReaderContract { read(): string; }";
		const ast = new TypeScriptAstFile("protocols.ts", text);
		const indexes = ast
			.classes()
			.filter((node) => !node.type_contract)
			.map((node) => node.start);
		const rules = new ClassRules({ root: "", files: new Set(), resolver: new ProjectSourcePython() });
		const violations: ViolationContract[] = [];
		const normalization = jest.spyOn(TypeScriptAstFile.prototype, "classes");
		rules.append_typescript_classes(violations, "protocols.ts", text.split("\n"), ast.source_file, indexes);
		const passes = normalization.mock.calls.length;
		normalization.mockRestore();
		expect({ passes, violations }).toEqual({ passes: 0, violations: [] });
	});

	test("uses the prepared empty class result for an empty source", () => {
		const ast = new TypeScriptAstFile("empty.ts", "");
		const indexes = ast.classes().map((node) => node.start);
		const rules = new ClassRules({ root: "", files: new Set(), resolver: new ProjectSourcePython() });
		const violations: ViolationContract[] = [];
		const normalization = jest.spyOn(TypeScriptAstFile.prototype, "classes");
		rules.append_typescript_classes(violations, "empty.ts", [""], ast.source_file, indexes);
		const passes = normalization.mock.calls.length;
		normalization.mockRestore();
		expect({ passes, violations }).toEqual({ passes: 0, violations: [] });
	});
});
