import { describe, expect, test } from "@jest/globals";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";
import { ValueRules } from "src/linting/value_rules";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { ProxyCall } from "src/rules/typescript/syntax-rules/callables/proxy_call";
import { ProxyRules } from "src/rules/typescript/syntax-rules/callables/proxy_rules";
import { TypeScriptOverloadRules } from "src/rules/typescript/syntax-rules/callables/type_script_overload_rules";
import { TypeScriptConditionalRules } from "src/rules/typescript/syntax-rules/expressions/type_script_conditional_rules";
import { TypeScriptAnalysisScenario } from "tests/linting/type-script-analysis-scenario";
import ts from "typescript";

describe("TypeScript analysis algorithm regressions", () => {
	test("classifies a shared boolean initializer", () => {
		const scenario = new TypeScriptAnalysisScenario("flags.ts", "const seed = true;\nconst shared = seed && seed;");
		scenario.select_initializer("shared");
		const boolean_expression = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		const result = boolean_expression.boolean_expression(scenario._initializer, scenario._source_file);
		expect({ binding_found: scenario._binding_found, result }).toEqual({
			binding_found: true,
			result: true,
		});
	});

	test("rejects a cyclic boolean binding", () => {
		const scenario = new TypeScriptAnalysisScenario(
			"cycle.ts",
			"const left = right;\nconst right = left;\nconst cycle = left;",
		);
		scenario.select_initializer("cycle");
		const boolean_expression = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		const result = boolean_expression.boolean_expression(scenario._initializer, scenario._source_file);
		expect({ binding_found: scenario._binding_found, result }).toEqual({
			binding_found: true,
			result: false,
		});
	});

	test("shares declaration results between primitive and boolean consumers", () => {
		const scenario = new TypeScriptAnalysisScenario(
			"bindings.ts",
			"const count: number = 1;\nconst enabled: boolean = true;",
		);
		scenario.select_named_declarations();
		const declaration_index = new TypeScriptVariableDeclarationIndex();
		const primitive_rules = new ValueRules(declaration_index, new TypeScriptObjectAliasDeclarationIndex());
		const boolean_rules = new TypeScriptBooleanExpression(declaration_index);
		const primitive_result = primitive_rules.typed_primitive(scenario._count_name, scenario._source_file);
		const boolean_result = boolean_rules.boolean_expression(scenario._enabled_name, scenario._source_file);
		const first_index = declaration_index.declarations(scenario._source_file, "count");
		const reused_index = declaration_index.declarations(scenario._source_file, "count");
		expect({
			count_binding_found: scenario._count_binding_found,
			enabled_binding_found: scenario._enabled_binding_found,
			primitive_result,
			boolean_result,
			declaration_cache_reused: first_index === reused_index,
		}).toEqual({
			count_binding_found: true,
			enabled_binding_found: true,
			primitive_result: true,
			boolean_result: true,
			declaration_cache_reused: true,
		});
	});

	test("allows interface methods without overload siblings", () => {
		const method_count = 80;
		const methods = Array.from({ length: method_count }, (_, index) => `method_${index}(): void;`).join("\n");
		const source_file = ts.createSourceFile(
			"contracts.ts",
			`interface Contract {\n${methods}\n}`,
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration = source_file.statements.find(ts.isInterfaceDeclaration);
		const rules = new TypeScriptOverloadRules();
		const overloads: boolean[] = [];
		if (declaration !== undefined) {
			for (const member of declaration.members) {
				if (ts.isMethodSignature(member)) {
					overloads.push(rules.interface_method_overload(member));
				}
			}
		}
		expect({
			interface_found: declaration !== undefined,
			overloads: overloads.filter(Boolean).length,
		}).toEqual({
			interface_found: true,
			overloads: 0,
		});
	});

	test("does not classify platform API calls as forwarding functions", () => {
		const forward_count = 30;
		const source_lines = [
			'import { resolve } from "node:path";',
			...Array.from(
				{ length: forward_count },
				(_, index) => `export function forward_${index}(value: string): string { return resolve(value); }`,
			),
		];
		const source = source_lines.join("\n");
		const source_file = ts.createSourceFile("forwarders.ts", source, ts.ScriptTarget.Latest, true);
		const rules = new ProxyRules(
			new ProxyCall(new TypeScriptExpressionNames()),
			new TypeScriptObjectAliasDeclarationIndex(),
		);
		const forwarders = source_file.statements.filter(ts.isFunctionDeclaration);
		const classified = forwarders.map((node) => rules.proxy_callable(node));
		expect(classified).toEqual(Array.from({ length: forward_count }, () => false));
	});

	test("does not report a logical condition composed of valid calls", () => {
		const operand_count = 25;
		const operands = Array.from({ length: operand_count }, () => "is_ready()").join(" && ");
		const source_file = ts.createSourceFile(
			"conditions.ts",
			`function check(): void { if (${operands}) {} }`,
			ts.ScriptTarget.Latest,
			true,
		);
		const rules = new TypeScriptConditionalRules(new TypeScriptVariableDeclarationIndex());
		let append_count = 0;
		/** Responsibilities: _conditional source traversal_. **/
		const visit = (node: ts.Node): void => {
			rules.append(node, source_file, () => append_count++);
			node.forEachChild(visit);
		};
		visit(source_file);
		expect(append_count).toBe(0);
	});
});
