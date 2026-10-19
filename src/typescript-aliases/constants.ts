import ts from "typescript";

export const OBJECT_ALIAS_DECLARATION_CACHE = new WeakMap<ts.Node, readonly ts.Node[]>();
export const MEMBER_ALIAS_DECLARATION_CACHE = new WeakMap<ts.Node, readonly ts.VariableDeclaration[]>();
