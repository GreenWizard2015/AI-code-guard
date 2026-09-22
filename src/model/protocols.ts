import ts from 'typescript';
import type { DestructuredAlias } from 'src/model/types';
import type { DestructuredInstanceOptions } from 'src/model/types';

/** Responsibilities: _define callable owner resolution_. **/
export interface CallOwnerResolver {
	call_owner(expression: ts.Expression, owner: string): string;
}

/** Responsibilities: _define TypeScript instance alias_. **/
export interface TypeScriptInstanceStore {
	add(name: string, owner: string, ...nodes: ts.Node[]): void;
	add_all(entries: readonly DestructuredAlias[], node: ts.Node): void;
	add_destructured(options: DestructuredInstanceOptions): void;
	instance_owner(name: string, node: ts.Node): string;
}
