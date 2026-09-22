import type ts from 'typescript';

export type JestCallbackKind = 'arrow' | 'function' | 'other';

export type JestSuite = {
	node: ts.CallExpression;
	body: ts.Block[];
	tests: ts.CallExpression[];
	nested: boolean;
};
