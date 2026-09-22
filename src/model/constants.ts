import ts from 'typescript';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { RULE_DATA } from 'src/parser/ts/constants';
import type { Rule } from 'src/protocols';

export const VISIBILITY_MODIFIERS = [
	ts.SyntaxKind.PublicKeyword,
	ts.SyntaxKind.ProtectedKeyword,
	ts.SyntaxKind.PrivateKeyword,
];

export const RULES_BY_ID: Map<string, Rule> = new Map(
	Object.keys(RULE_DATA).map(rule_id => [rule_id, new DiagnosticRule(rule_id)])
);
