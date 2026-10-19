import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("in-memory project source text", () => {
	test("preserves exact line endings for each source path", () => {
		const root = "/virtual/source-text";
		const source = new InMemoryProjectSourceIO(
			new Map([
				[`${root}/windows.ts`, "first\r\nsecond\r\n"],
				[`${root}/plain.ts`, "first\nsecond\n"],
			]),
		);
		const text = {
			windows: source.source_text(`${root}/windows.ts`),
			plain: source.source_text(`${root}/plain.ts`),
		};

		expect(text).toEqual({ windows: "first\r\nsecond\r\n", plain: "first\nsecond\n" });
	});

	test("returns an empty string for a path outside the source snapshot", () => {
		const source = new InMemoryProjectSourceIO(new Map());
		const available = source.source_available("/virtual/missing.ts");
		const text = source.source_text("/virtual/missing.ts");

		expect({ available, text }).toEqual({ available: false, text: "" });
	});
});
