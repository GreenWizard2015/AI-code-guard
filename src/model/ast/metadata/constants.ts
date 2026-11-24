import { TYPESCRIPT_TREE_METADATA_FLAGS } from "src/constants";
import type {
	TypeScriptMetadataNodeFlagGroup,
	TypeScriptMetadataNodeIndexConfiguration,
} from "src/model/ast/normalized_ast_types";
import ts from "typescript";

const METADATA_NODE_FLAG_GROUPS: readonly TypeScriptMetadataNodeFlagGroup[] = [
	{
		node_kinds: [ts.SyntaxKind.ImportSpecifier, ts.SyntaxKind.NamespaceImport, ts.SyntaxKind.ImportClause],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.import_symbol,
	},
	{
		node_kinds: [
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.PropertySignature,
		],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.named_symbol,
	},
	{
		node_kinds: [ts.SyntaxKind.Parameter, ts.SyntaxKind.VariableDeclaration],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.named_symbol | TYPESCRIPT_TREE_METADATA_FLAGS.call_reference,
	},
	{
		node_kinds: [
			ts.SyntaxKind.PropertyAssignment,
			ts.SyntaxKind.ReturnStatement,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.NewExpression,
			ts.SyntaxKind.ArrayLiteralExpression,
		],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.call_reference,
	},
	{
		node_kinds: [ts.SyntaxKind.ImportDeclaration, ts.SyntaxKind.ImportEqualsDeclaration, ts.SyntaxKind.ImportType],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.import_issue | TYPESCRIPT_TREE_METADATA_FLAGS.source_line,
	},
	{
		node_kinds: [ts.SyntaxKind.CallExpression],
		flags:
			TYPESCRIPT_TREE_METADATA_FLAGS.import_issue |
			TYPESCRIPT_TREE_METADATA_FLAGS.source_line |
			TYPESCRIPT_TREE_METADATA_FLAGS.call_reference,
	},
	{
		node_kinds: [
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.EnumDeclaration,
		],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.type_declaration,
	},
	{
		node_kinds: [ts.SyntaxKind.PropertyAccessExpression],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.property_access | TYPESCRIPT_TREE_METADATA_FLAGS.source_line,
	},
	{
		node_kinds: [ts.SyntaxKind.Identifier],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.identifier,
	},
	{
		node_kinds: [ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral],
		flags: TYPESCRIPT_TREE_METADATA_FLAGS.literal | TYPESCRIPT_TREE_METADATA_FLAGS.source_line,
	},
];

export const TYPESCRIPT_CLASS_METADATA_NODE_KINDS: readonly ts.SyntaxKind[] = [
	ts.SyntaxKind.ClassDeclaration,
	ts.SyntaxKind.ClassExpression,
	ts.SyntaxKind.InterfaceDeclaration,
];

const METADATA_FLAGS_BY_KIND = new Map<ts.SyntaxKind, number>();
for (const group of METADATA_NODE_FLAG_GROUPS) {
	for (const node_kind of group.node_kinds) {
		METADATA_FLAGS_BY_KIND.set(node_kind, group.flags);
	}
}

const METADATA_NODE_KINDS: ts.SyntaxKind[] = [];
const SEEN_METADATA_NODE_KINDS = new Set<number>();
for (const node_kind of Object.values(ts.SyntaxKind)) {
	if (typeof node_kind !== "number") {
		continue;
	}
	if (METADATA_FLAGS_BY_KIND.get(node_kind) === undefined) {
		continue;
	}
	if (SEEN_METADATA_NODE_KINDS.has(node_kind)) {
		continue;
	}
	METADATA_NODE_KINDS.push(node_kind);
	SEEN_METADATA_NODE_KINDS.add(node_kind);
}

export const TYPE_SCRIPT_METADATA_NODE_INDEX_CONFIGURATION: TypeScriptMetadataNodeIndexConfiguration = {
	flags_by_kind: METADATA_FLAGS_BY_KIND,
	node_kinds: METADATA_NODE_KINDS,
};
