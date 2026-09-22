import ts from 'typescript';

export const IMPORT_KINDS = new Set([
	ts.SyntaxKind.ImportDeclaration,
	ts.SyntaxKind.ImportEqualsDeclaration,
]);
export const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.py']);
export const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage']);
export const PROJECT_PREFIXES = ['packages/', 'scripts/', 'tools/', 'tests/'];
