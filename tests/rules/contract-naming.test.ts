import { ContractNames } from "src/rules/contract_names";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstClassNodeContract } from "src/types";
import { describe, expect, test } from "@jest/globals";

describe("contract naming rule", () => {
	test("requires a domain Contract suffix without protocol words", () => {
		const contracts = new ContractNames();
		const violations: ViolationContract[] = [];
		const contract: AstClassNodeContract = {
			name: "",
			start: 0,
			end: 1,
			methods: [],
			lines: 1,
			sloc: 1,
			interfaces: [],
			base_class_name: "",
			base_class_names: [],
			extends_external_class: false,
			is_data_class: false,
			type_contract: true,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			fields: [],
			untyped_fields: [],
			dependencies: [],
		};
		contracts.append(violations, "source.ts", [
			{ ...contract, name: "UserRepositoryContract", start: 0 },
			{ ...contract, name: "UserProtocolContract", start: 1 },
			{ ...contract, name: "UserInterfaceContract", start: 2 },
			{ ...contract, name: "UserProtoContract", start: 3 },
		]);

		expect(violations.map((violation) => violation.line)).toEqual([2, 3, 4]);
	});

	test("accepts a domain contract name", () => {
		const contracts = new ContractNames();
		const violations: ViolationContract[] = [];
		contracts.append(violations, "source.ts", [
			{
				name: "UserRepositoryContract",
				start: 0,
				end: 1,
				methods: [],
				lines: 1,
				sloc: 1,
				interfaces: [],
				base_class_name: "",
				base_class_names: [],
				extends_external_class: false,
				is_data_class: false,
				type_contract: true,
				protocol: false,
				callback_fields: 0,
				inline_callback_fields: 0,
				fields: [],
				untyped_fields: [],
				dependencies: [],
			},
		]);
		expect(violations).toEqual([]);
	});

	test("rejects protocol words in Python Protocol names", () => {
		const contracts = new ContractNames();
		const violations: ViolationContract[] = [];
		contracts.append(violations, "source.py", [
			{
				name: "UserProtocolContract",
				start: 0,
				end: 1,
				methods: [],
				lines: 1,
				sloc: 1,
				interfaces: [],
				base_class_name: "",
				base_class_names: [],
				extends_external_class: false,
				is_data_class: false,
				type_contract: false,
				protocol: true,
				callback_fields: 0,
				inline_callback_fields: 0,
				fields: [],
				untyped_fields: [],
				dependencies: [],
			},
			{
				name: "UserRepositoryContract",
				start: 1,
				end: 2,
				methods: [],
				lines: 1,
				sloc: 1,
				interfaces: [],
				base_class_name: "",
				base_class_names: [],
				extends_external_class: false,
				is_data_class: false,
				type_contract: false,
				protocol: true,
				callback_fields: 0,
				inline_callback_fields: 0,
				fields: [],
				untyped_fields: [],
				dependencies: [],
			},
		]);
		expect(violations.map((violation) => violation.line)).toEqual([1]);
	});
});
