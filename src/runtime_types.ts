import type ts from "typescript";
import type { StringSetMap, ObjectSourceVisitor } from "src/analysis_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintRunResult } from "src/project_analysis_types";

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

export type BindingAliasAppender = (binding: ts.BindingName, initializer: ts.Expression) => boolean;

export type ExpressionNormalizer = (expression: ts.Expression) => ts.Expression;

export type AliasAppender = (name: string, initializer: ts.Expression) => boolean;

export type MemberAliasAppender = (aliases: StringSetMap, name: string, property: string) => boolean;

export type MemberValueAppendRequest = {
	aliases: StringSetMap;
	name: string;
	initializer: ts.Expression;
	node: ts.Node;
};

export type MemberValueAppender = (request: MemberValueAppendRequest) => boolean;

export type ExpressionUnwrapper = (expression: ts.Expression) => ts.Expression;

export type StaticObjectBranchAppender = (expression: ts.Expression) => boolean;

export type StaticObjectValueAppender = (value: ts.Expression) => boolean;

export type SourceLineResolver = (position: number) => number;

export type Operation<T> = () => T;

export type AsyncOperation<T> = () => Promise<T>;

export type SpreadValueAppender = (expression: ts.Expression) => boolean;

export type StaticValueResolver = (expression: ts.Expression, node: ts.Node) => string;

export type MapValueAppender = (values: Map<string, string>, name: string, initializer: ts.Expression) => boolean;

export type NodeBodyResolver<T> = (body: ts.Node) => T;

export type StatementPredicate = (statement: ts.Statement) => boolean;

export type NameRelationsResolver = (name: string) => string[];

export type ObjectSourceAppender = (expression: ts.Expression, visitor: ObjectSourceVisitor) => void;

export type CallableConsumer = (callback: ts.FunctionLikeDeclaration) => void;

export type ArrayValuesVisitor = (values: readonly ts.Expression[]) => void;
