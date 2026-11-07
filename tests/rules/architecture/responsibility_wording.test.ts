import { describe, expect, test } from "@jest/globals";
import {
	RESPONSIBILITY_ACTION_EXTENSIONS,
	RESPONSIBILITY_ACTION_WORDS,
	RESPONSIBILITY_CONDITION_WORDS,
	RESPONSIBILITY_NOUN_WORDS,
} from "src/constants";
import { ResponsibilityWording } from "src/rules/architecture/responsibility_wording";

describe("responsibility wording", () => {
	test("checks every word while separating noun forms", () => {
		const checker = new ResponsibilityWording(
			new Set([...RESPONSIBILITY_ACTION_WORDS, ...RESPONSIBILITY_ACTION_EXTENSIONS]),
			RESPONSIBILITY_CONDITION_WORDS,
			RESPONSIBILITY_NOUN_WORDS,
		);

		expect({
			verb_phrase: checker.valid(["user validate"]),
			noun_gerund: checker.valid(["data processing"]),
			call_noun: checker.valid(["call result binding"]),
			return_noun: checker.valid(["explicit return requirements"]),
			scan_noun: checker.valid(["file scan state"]),
			query_noun: checker.valid(["dynamic member name query"]),
		}).toEqual({
			verb_phrase: false,
			noun_gerund: true,
			call_noun: true,
			return_noun: true,
			scan_noun: true,
			query_noun: true,
		});
	});

	test("rejects condition words and phrases beyond the word limit", () => {
		const checker = new ResponsibilityWording(
			new Set([...RESPONSIBILITY_ACTION_WORDS, ...RESPONSIBILITY_ACTION_EXTENSIONS]),
			RESPONSIBILITY_CONDITION_WORDS,
			RESPONSIBILITY_NOUN_WORDS,
		);

		expect({
			condition: checker.valid(["state if changed"]),
			at_limit: checker.valid(["one two three four"]),
			too_long: checker.valid(["one two three four five"]),
		}).toEqual({ condition: false, at_limit: true, too_long: false });
	});
});
