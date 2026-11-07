import { describe, expect, test } from "@jest/globals";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DeclarationNames } from "src/rules/declaration_names";

describe("contract naming rule", () => {
	const TYPE_CONTRACT_NODE: AstClassNode = {
		identity: { name: "UserRepositoryContract", start: 0, end: 1, lines: 1, sloc: 1 },
		structure: { methods: [], interfaces: [], base_class_names: [], dependencies: [] },
		classification: { extends_external_class: false, is_data_class: false, type_contract: true, protocol: false },
		field_analysis: { callback_fields: 0, inline_callback_fields: 0, fields: [], untyped_fields: [] },
	};
	const PROTOCOL_NODE: AstClassNode = {
		...TYPE_CONTRACT_NODE,
		classification: { ...TYPE_CONTRACT_NODE.classification, type_contract: false, protocol: true },
	};
	const typescript_contracts: AstClassNode[] = [
		TYPE_CONTRACT_NODE,
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "UserProtocolContract", start: 1, end: 2 },
		},
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "UserInterfaceContract", start: 2, end: 3 },
		},
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "UserProtoContract", start: 3, end: 4 },
		},
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "UserProtContract", start: 4, end: 5 },
		},
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "ContractNameAliasLookupContract", start: 5, end: 6 },
		},
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "ConcreteContract", start: 6, end: 7 },
			classification: { ...TYPE_CONTRACT_NODE.classification, type_contract: false },
		},
		{
			...TYPE_CONTRACT_NODE,
			identity: { ...TYPE_CONTRACT_NODE.identity, name: "Repository", start: 7, end: 8 },
		},
	];
	const python_protocols: AstClassNode[] = [
		{
			...PROTOCOL_NODE,
			identity: { ...PROTOCOL_NODE.identity, name: "UserProtocolContract", start: 0, end: 1 },
		},
		{
			...PROTOCOL_NODE,
			identity: { ...PROTOCOL_NODE.identity, name: "UserProtContract", start: 1, end: 2 },
		},
		{
			...PROTOCOL_NODE,
			identity: { ...PROTOCOL_NODE.identity, name: "UserRepositoryContract", start: 2, end: 3 },
		},
		{
			...PROTOCOL_NODE,
			identity: { ...PROTOCOL_NODE.identity, name: "UserContractRepository", start: 3, end: 4 },
		},
		{
			...PROTOCOL_NODE,
			identity: { ...PROTOCOL_NODE.identity, name: "ConcreteContract", start: 4, end: 5 },
			classification: { ...PROTOCOL_NODE.classification, protocol: false },
		},
		{
			...PROTOCOL_NODE,
			identity: { ...PROTOCOL_NODE.identity, name: "Reader", start: 5, end: 6 },
		},
	];

	test("requires a domain Contract suffix without protocol words", () => {
		const violations: ViolationContract[] = [];
		const contract_names = new DeclarationNames("source.ts", typescript_contracts, [
			{ name: "ResultContract", line: 6 },
			{ name: "ResultInterface", line: 7 },
		]);
		contract_names.append(violations);

		expect(violations.map((violation) => violation.line())).toEqual([2, 3, 4, 5, 6, 7, 8, 7, 8]);
	});

	test("accepts a domain contract name", () => {
		const violations: ViolationContract[] = [];
		const contract_names = new DeclarationNames("source.ts", [TYPE_CONTRACT_NODE]);
		contract_names.append(violations);
		expect(violations).toEqual([]);
	});

	test("rejects protocol words in Python Protocol names", () => {
		const violations: ViolationContract[] = [];
		const contract_names = new DeclarationNames("source.py", python_protocols, [{ name: "ResponseContract", line: 6 }]);
		contract_names.append(violations);
		expect(violations.map((violation) => violation.line())).toEqual([1, 2, 4, 5, 6, 7]);
	});
});
