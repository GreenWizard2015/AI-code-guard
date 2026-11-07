import { TypeScriptStatementSloc } from "src/metrics/type_script_statement_sloc";
import ts from "typescript";

describe("TypeScript statement SLOC", () => {
	test("returns a stable count for repeated measurement of one statement", () => {
		const source = ts.createSourceFile(
			"sample.ts",
			"if (ready) { work(); } else { wait(); }",
			ts.ScriptTarget.Latest,
			true,
		);
		const measurement = new TypeScriptStatementSloc();
		const first = source.statements.map((statement) => measurement.statement_sloc(statement));
		const second = source.statements.map((statement) => measurement.statement_sloc(statement));

		expect({ first, second }).toEqual({ first: [3], second: [3] });
	});

	test("counts loop bodies and simple statements from parsed source", () => {
		const source = ts.createSourceFile(
			"sample.ts",
			"while (ready) { work(); }\nfinish();",
			ts.ScriptTarget.Latest,
			true,
		);
		const measurement = new TypeScriptStatementSloc();
		const sloc = source.statements.map((statement) => measurement.statement_sloc(statement));

		expect(sloc).toEqual([2, 1]);
	});
});
