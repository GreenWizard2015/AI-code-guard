import { resolve, sep } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ProjectPathRelation } from "src/core/support/project_path_relation";

describe("project path relation", () => {
	test("classifies a descendant and matches ignored directory names", () => {
		const root = resolve("workspace/project");
		const candidate = resolve(root, "src", "main.ts");
		const relation = new ProjectPathRelation(root, candidate);

		expect({
			path: relation.path(),
			inside: relation.inside_root(),
			nested: relation.strictly_nested(),
			ignored_directory: relation.contains_any_directory(new Set(["src"])),
		}).toEqual({
			path: ["src", "main.ts"].join(sep),
			inside: true,
			nested: true,
			ignored_directory: true,
		});
	});

	test("classifies the root itself as inside but not nested", () => {
		const root = resolve("workspace/project");
		const relation = new ProjectPathRelation(root, root);

		expect({ path: relation.path(), inside: relation.inside_root(), nested: relation.strictly_nested() }).toEqual({
			path: "",
			inside: true,
			nested: false,
		});
	});

	test("classifies a sibling path as outside the root", () => {
		const root = resolve("workspace/project");
		const candidate = resolve("workspace/other/main.ts");
		const relation = new ProjectPathRelation(root, candidate);

		expect({ path: relation.path(), inside: relation.inside_root(), nested: relation.strictly_nested() }).toEqual({
			path: ["..", "other", "main.ts"].join(sep),
			inside: false,
			nested: false,
		});
	});

	test("does not treat a sibling with a shared text prefix as a descendant", () => {
		const relation = new ProjectPathRelation("/workspace/project", "/workspace/project-copy/main.ts");

		expect({ path: relation.path(), inside: relation.inside_root() }).toEqual({
			path: ["..", "project-copy", "main.ts"].join(sep),
			inside: false,
		});
	});

	test("matches complete path segments only", () => {
		const relation = new ProjectPathRelation("workspace/project", "workspace/project/src/components/main.ts");

		expect({
			component: relation.contains_any_directory(new Set(["components"])),
			partial: relation.contains_any_directory(new Set(["component"])),
			prefix: relation.contains_any_directory(new Set(["src-components"])),
		}).toEqual({ component: true, partial: false, prefix: false });
	});

	test("returns false when no directory names were supplied", () => {
		const relation = new ProjectPathRelation("workspace/project", "workspace/project/src/main.ts");

		expect(relation.contains_any_directory(new Set())).toBe(false);
	});

	test("normalizes relative root and candidate paths consistently", () => {
		const relation = new ProjectPathRelation("workspace/project", "workspace/project/src/main.ts");

		expect({ path: relation.path(), inside: relation.inside_root() }).toEqual({
			path: ["src", "main.ts"].join(sep),
			inside: true,
		});
	});

	test("falls back to path normalization for noncanonical absolute paths", () => {
		const relation = new ProjectPathRelation("/workspace/project", "/workspace/project/src/../outside.ts");

		expect({ path: relation.path(), inside: relation.inside_root() }).toEqual({
			path: "outside.ts",
			inside: true,
		});
	});

	test("preserves root and separator normalization behavior", () => {
		const root_relation = new ProjectPathRelation("/", "/workspace/project");
		const trailing_relation = new ProjectPathRelation("/workspace/project/", "/workspace/project/src/");
		const repeated_relation = new ProjectPathRelation("/workspace/project", "/workspace/project//src");

		expect({
			root_path: root_relation.path(),
			trailing_path: trailing_relation.path(),
			repeated_path: repeated_relation.path(),
		}).toEqual({
			root_path: ["workspace", "project"].join(sep),
			trailing_path: "src",
			repeated_path: "src",
		});
	});
});
