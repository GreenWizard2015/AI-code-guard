import { describe, expect, test } from "@jest/globals";
import { NamingValidation } from "src/rules/naming_validation";

describe("naming validation word cache", () => {
	test("reuses immutable word segmentation for a repeated name", () => {
		const validation = new NamingValidation("first.ts");
		const first = validation.name_words("loadSourceRecord");
		const repeated = validation.name_words("loadSourceRecord");

		expect({ words: first, same_result: repeated === first }).toEqual({
			words: ["load", "Source", "Record"],
			same_result: true,
		});
	});

	test("keeps word segmentation isolated by source name", () => {
		const validation = new NamingValidation("second.ts");
		const names = [validation.name_words("readFile"), validation.name_words("writeFile")];

		expect(names).toEqual([
			["read", "File"],
			["write", "File"],
		]);
	});
});
