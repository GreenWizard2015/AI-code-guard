import type ts from 'typescript';

export type StaticKeyCollectionState = {
	values: Map<string, string>;
	objects: Map<string, ts.ObjectLiteralExpression>;
};
