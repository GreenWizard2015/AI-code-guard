import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import ts from "typescript";

/** Responsibilities: _AST reference fixture construction_, _property access selection_. **/
export class TypeScriptReferenceIdentityFixture {
	/** Responsibilities: _source-file retrieval_. **/
	public required_source_file(source_files: ReadonlyMap<string, ts.SourceFile>, file: string): ts.SourceFile {
		const source = source_files.get(file);
		if (source === undefined) {
			throw new Error(`Consumer fixture source is missing: ${file}`);
		}
		return source;
	}

	/** Responsibilities: _source AST creation_. **/
	public source_files(root: string, texts: Record<string, string>): Map<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const [name, text] of Object.entries(texts)) {
			const file = `${root}/${name}`;
			const ast_file = new TypeScriptAstFile(file, text);
			source_files.set(file, ast_file.source_file_node());
		}
		return source_files;
	}

	/** Responsibilities: _in-memory source access creation_. **/
	public source_io(root: string, texts: Record<string, string>): InMemoryProjectSourceIO {
		return new InMemoryProjectSourceIO(new Map(Object.entries(texts).map(([name, text]) => [`${root}/${name}`, text])));
	}

	/** Responsibilities: _property access retrieval_. **/
	public property_access(source: ts.SourceFile, name: string): ts.PropertyAccessExpression {
		let match: ts.PropertyAccessExpression | undefined;
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node)) {
				if (node.name.text === name) {
					match = node;
				}
			}
			node.forEachChild(visit);
		};
		visit(source);
		if (match === undefined) {
			throw new Error(`Expected ${name} property access is missing.`);
		}
		return match;
	}

	/** Responsibilities: _ordered property access retrieval_. **/
	public property_accesses(source: ts.SourceFile, name: string): ts.PropertyAccessExpression[] {
		const matches: ts.PropertyAccessExpression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node)) {
				if (node.name.text === name) {
					matches.push(node);
				}
			}
			node.forEachChild(visit);
		};
		visit(source);
		return matches;
	}

	/** Responsibilities: _property accesses by owner_. **/
	public property_accesses_by_owner(
		source: ts.SourceFile,
		property_name: string,
		owner_names: ReadonlySet<string>,
	): ReadonlyMap<string, ts.PropertyAccessExpression> {
		const accesses = new Map<string, ts.PropertyAccessExpression>();
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node)) {
				if (node.name.text === property_name) {
					if (ts.isIdentifier(node.expression)) {
						if (owner_names.has(node.expression.text)) {
							accesses.set(node.expression.text, node);
						}
					}
				}
			}
			node.forEachChild(visit);
		};
		visit(source);
		for (const name of owner_names) {
			if (!accesses.has(name)) {
				throw new Error(`Expected ${property_name} access for ${name} is missing.`);
			}
		}
		return accesses;
	}

	/** Responsibilities: _property access by owner_. **/
	public required_property_access(
		accesses: ReadonlyMap<string, ts.PropertyAccessExpression>,
		owner_name: string,
	): ts.PropertyAccessExpression {
		const access = accesses.get(owner_name);
		if (access === undefined) {
			throw new Error(`Expected property access for ${owner_name} is missing.`);
		}
		return access;
	}
}
