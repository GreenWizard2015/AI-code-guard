import { describe, expect, test } from "@jest/globals";
import { ProjectTypeBoundary } from "src/metrics/project-type-boundary";
import type { Violation } from "src/protocols";
import { CONTRACT_BOUNDARY_CALLABLE, PROJECT_BOUNDARY_CALLABLE } from "tests/metrics/constants";

describe("ProjectTypeBoundary", () => {
	test("rejects aliased project classes and allows contract types", () => {
		const violations: Violation[] = [];
		const boundary = new ProjectTypeBoundary({
			violations,
			file: "service.ts",
			callables: [PROJECT_BOUNDARY_CALLABLE, CONTRACT_BOUNDARY_CALLABLE],
			project_types: new Set(["User", "UserPort"]),
			allowed_contracts: new Set(["UserPort"]),
			reference_aliases: [{ name: "UserAlias", target: "User" }],
			language: "typescript",
		});

		boundary.append();

		expect(violations).toHaveLength(1);
		expect(violations[0]?.rule_id).toBe("project-type-boundary");
	});

	test("ignores private implementation boundaries", () => {
		const violations: Violation[] = [];
		const boundary = new ProjectTypeBoundary({
			violations,
			file: "service.ts",
			callables: [{ ...PROJECT_BOUNDARY_CALLABLE, visibility: "private", owner: "Service" }],
			project_types: new Set(["User"]),
			allowed_contracts: new Set(),
			reference_aliases: [],
			language: "typescript",
		});

		boundary.append();

		expect(violations).toHaveLength(0);
	});
});
