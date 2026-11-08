import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { LintFileName } from "src/core/context/lint_file_name";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import type { AstClassField, AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptAstTypeShape } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_ast_type_shape";
import { TypeScriptClassFieldClassifier } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_class_field_classifier";
import { TestFixture } from "tests/core/test-fixture";
import ts from "typescript";

describe("class state ownership", () => {
	const READONLY_METADATA_FIELDS: Partial<AstClassField>[] = [
		{
			line: 1,
			name: "typescript_language",
			value_name: "TYPESCRIPT_LANGUAGE",
			type: "string",
			type_kind: "basic",
			readonly: true,
			class_variable: false,
			class_scope: false,
			visibility: "private",
		},
		{
			line: 2,
			name: "known_names",
			value_name: "KNOWN_NAMES",
			type: "ReadonlySet<string>",
			type_kind: "generic",
			readonly: true,
			class_variable: false,
			class_scope: false,
			visibility: "private",
		},
		{
			line: 3,
			name: "metadata_provider",
			value_name: "MetadataProvider",
			type: "MetadataProvider",
			type_kind: "named",
			readonly: true,
			class_variable: false,
			class_scope: false,
			visibility: "private",
		},
	];

	test("classifies uninitialized and collection-initialized fields", () => {
		const source_file = ts.createSourceFile(
			"field-classification.ts",
			"class Store { pending; records = new Map(); }",
			ts.ScriptTarget.Latest,
			true,
		);
		const classifications = source_file.statements.filter(ts.isClassDeclaration).map((declaration) => {
			const classifier = new TypeScriptClassFieldClassifier(declaration);
			return { pending: classifier.field("pending"), records: classifier.field("records") };
		});

		expect(classifications).toEqual([
			{
				pending: { data: false, scalar: false, collection: false, is_public: true },
				records: { data: true, scalar: false, collection: true, is_public: true },
			},
		]);
	});

	test("classifies nested data, scalar, and collection types", () => {
		const nested_scalar = ts.factory.createParenthesizedType(
			ts.factory.createUnionTypeNode([
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
			]),
		);
		const collection = ts.factory.createTypeReferenceNode("ReadonlyMap", [
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
		]);
		const domain = ts.factory.createTypeReferenceNode("DomainRecord");
		const scalar_shape = new TypeScriptAstTypeShape(nested_scalar);
		const collection_shape = new TypeScriptAstTypeShape(collection);
		const domain_shape = new TypeScriptAstTypeShape(domain);

		expect({
			scalar_data: scalar_shape.data_type(),
			scalar: scalar_shape.scalar_type(),
			collection_data: collection_shape.data_type(),
			collection: collection_shape.collection_type(),
			domain_data: domain_shape.data_type(),
		}).toEqual({
			scalar_data: true,
			scalar: true,
			collection_data: true,
			collection: true,
			domain_data: false,
		});
	});

	test("reports stateless classes and forbids local class inheritance", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "Child",
			start: 4,
			end: 20,
			lines: 16,
			sloc: 16,
			interfaces: [],
			base_class_names: ["Base"],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [{ name: "run", start: 5, end: 8, argument_count: 0 }],
			fields: [
				{
					line: 2,
					name: "shared_cache",
					value_name: "Map",
					type: "Map<string, string>",
					type_kind: "generic",
					readonly: false,
					class_variable: true,
					class_scope: false,
					visibility: "private",
				},
				{
					line: 3,
					name: "class_registry",
					value_name: "Map",
					type: "Map<string, string>",
					type_kind: "generic",
					readonly: false,
					class_variable: false,
					class_scope: true,
					visibility: "private",
				},
			],
			untyped_fields: [],
			dependencies: [],
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("local.ts"),
			node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			project_class_names: new Set(node.structure.base_class_names),
			project_contract_names: new Set(node.structure.interfaces ?? []),
			project_alias_names: new Set(),
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
		});
		reporter.report_design();

		expect(violations.map((item) => ({ message: item.message(), priority: item.priority() }))).toEqual(
			expect.arrayContaining([
				{ message: "class is stateless", priority: 6 },
				{ message: 'declaration inherits from non-contract base "Base"', priority: 6 },
			]),
		);
	});

	test("keeps readonly metadata non-state when the class implements a contract", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "SourceNames",
			start: 0,
			end: 12,
			lines: 12,
			sloc: 12,
			interfaces: ["SourceNamesContract"],
			methods: [{ name: "names_for_source", start: 3, end: 10, argument_count: 2 }],
			fields: READONLY_METADATA_FIELDS,
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("source_names.ts"),
			node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
			project_class_names: new Set(node.structure.base_class_names),
			project_contract_names: new Set(node.structure.interfaces),
			project_alias_names: new Set(),
		});
		reporter.report_design();

		expect(violations.some((item) => item.rule_id() === "stateless-class")).toBe(false);
	});

	test("reports readonly metadata as stateless without a contract boundary", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "ReadonlyMetadataHelper",
			start: 0,
			end: 12,
			lines: 12,
			sloc: 12,
			methods: [{ name: "names_for_source", start: 3, end: 10, argument_count: 2 }],
			fields: READONLY_METADATA_FIELDS,
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("source_names.ts"),
			node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
			project_class_names: new Set(node.structure.base_class_names),
			project_contract_names: new Set(node.structure.interfaces),
			project_alias_names: new Set(),
		});
		reporter.report_design();

		expect(violations.map((item) => item.rule_id())).toContain("stateless-class");
	});
});
