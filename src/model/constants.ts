import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { RULE_DATA } from "src/constants";
import type { RuleContract } from "src/protocols";

export const VISIBILITY_MODIFIERS = [
	ts.SyntaxKind.PublicKeyword,
	ts.SyntaxKind.ProtectedKeyword,
	ts.SyntaxKind.PrivateKeyword,
];

export const RULES_BY_ID: Map<string, RuleContract> = new Map(
	Object.keys(RULE_DATA).map((rule_id) => [rule_id, new DiagnosticRule(rule_id)]),
);
