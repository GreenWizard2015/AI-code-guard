import type { StringSetMap } from "src/analysis_types";
import type { LintRunResult } from "src/project_analysis_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type ts from "typescript";

export type LintExecutionReport = { context: LintProjectContextContract; report: LintRunResult };
export type LintStageDuration = { name: string; duration_ms: number };
export type LintStageFormatState = {
	lines: string[];
	parent_name: string;
	stage: LintStageDuration;
	durations_by_name: ReadonlyMap<string, LintStageDuration>;
	children: ReadonlyMap<string, readonly LintStageDuration[]>;
	indent: string;
};

export type CallableExpressionNormalizer = (expression: ts.Expression) => ts.Expression;

export type CallableAliasAppender = (name: string, initializer: ts.Expression) => boolean;

export type CallableMemberAliasAppender = (aliases: StringSetMap, name: string, property: string) => boolean;

export type MemberValueAppendRequest = {
	aliases: StringSetMap;
	name: string;
	initializer: ts.Expression;
	node: ts.Node;
};

export type CallableMemberValueAppender = (request: MemberValueAppendRequest) => boolean;

export type CallableExpressionUnwrapper = (expression: ts.Expression) => ts.Expression;

export type CallableStaticObjectBranchAppender = (expression: ts.Expression) => boolean;

export type CallableStaticObjectValueAppender = (value: ts.Expression) => boolean;

export type CallableSourceLineResolver = (position: number) => number;

export type CallableOperation<T> = () => T;

export type CallableAsyncOperation<T> = () => Promise<T>;

export type CallableSpreadValueAppender = (expression: ts.Expression) => boolean;

export type CallableStaticValueResolver = (expression: ts.Expression, node: ts.Node) => string;

export type CallableMapValueAppender = (
	values: Map<string, string>,
	name: string,
	initializer: ts.Expression,
) => boolean;

export type CallableNodeBodyResolver<T> = (body: ts.Node) => T;

export type CallableStatementPredicate = (statement: ts.Statement) => boolean;

export type CallableNameRelationsResolver = (name: string) => string[];

export type CallableConsumer = (callback: ts.FunctionLikeDeclaration) => void;

export type CallableArrayValuesVisitor = (values: readonly ts.Expression[]) => void;
