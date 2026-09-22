import { createHash } from 'node:crypto';
import ts from 'typescript';

import type { AstClassNode, DuplicateTypeShape, NamedLine, NamedShape } from 'src/types';

/** Responsibilities: _normalization TypeScript Python type_. **/
export class DuplicateTypeShapes {
	private readonly hash_algorithm = 'sha256';
	/** Responsibilities: _creation stable hash fields_. **/
	private shape_hash(fields: readonly string[], base_names: readonly string[]): string {
		const sorted_fields = [...fields].sort((left, right) => left.localeCompare(right));
		const sorted_base_names = [...base_names].sort((left, right) => left.localeCompare(right));
		const serialized = [...sorted_base_names.map(base => `base:${base}`), ...sorted_fields].join('\n');
		return createHash(this.hash_algorithm).update(serialized).digest('hex');
	}

	/** Responsibilities: _named shape its addition_. **/
	private add_shape(groups: Map<string, NamedLine[]>, shape: NamedShape): void {
		if (shape.fields.length === 0) {
			return;
		}
		const hash = this.shape_hash(shape.fields, shape.base_names);
		let matches = groups.get(hash);
		if (matches === undefined) {
			matches = [];
			groups.set(hash, matches);
		}
		matches.push({ name: shape.name, line: shape.line });
	}

	/** Responsibilities: _identification groups containing duplicate_. **/
	private duplicate_groups(shapes: readonly NamedShape[]): DuplicateTypeShape[] {
		const groups = new Map<string, NamedLine[]>();
		for (const shape of shapes) {
			this.add_shape(groups, shape);
		}
		const duplicates: DuplicateTypeShape[] = [];
		for (const matches of groups.values()) {
			if (matches.length < 2) {
				continue;
			}
			const first = matches[0];
			duplicates.push({ line: first.line, names: matches.map(match => match.name) });
		}
		return duplicates;
	}

	/** Responsibilities: _extraction members TypeScript interface_. **/
	private type_members(statement: ts.Statement): readonly ts.TypeElement[] {
		if (ts.isInterfaceDeclaration(statement)) {
			return statement.members;
		}
if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
			return statement.type.members;
		}
		return [];
	}

	/** Responsibilities: _resolution declared name TypeScript_. **/
	private type_name(statement: ts.Statement): string {
if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
			return statement.name.text;
		}
		return '';
	}

	/** Responsibilities: _collection base names TypeScript_. **/
	private type_base_names(statement: ts.Statement, source_file: ts.SourceFile): string[] {
		if (!ts.isInterfaceDeclaration(statement)) {
			return [];
		}
		const clauses = statement.heritageClauses;
		if (clauses === undefined) {
			return [];
		}
		return clauses
			.filter(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
			.flatMap(clause => clause.types.map(type => type.expression.getText(source_file)));
	}

	/** Responsibilities: _normalization TypeScript type member_. **/
	private type_field(member: ts.TypeElement, source_file: ts.SourceFile): string {
if (!ts.isPropertySignature(member) || member.name === undefined) {
			return '';
		}
		let type = '';
		if (member.type !== undefined) {
			type = member.type.getText(source_file);
		}
		return `${member.name.getText(source_file)}:${type}`;
	}

	/** Responsibilities: _collection normalization TypeScript interface_. **/
	private typescript_shapes(source_file: ts.SourceFile): NamedShape[] {
		const shapes: NamedShape[] = [];
		for (const statement of source_file.statements) {
			const members = this.type_members(statement);
			const name = this.type_name(statement);
			if (name === '' || members.length === 0) {
				continue;
			}
			const fields = members.map(member => this.type_field(member, source_file)).filter(field => field !== '');
			const line = source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line + 1;
			shapes.push({
				name,
				line,
				fields,
				base_names: this.type_base_names(statement, source_file),
			});
		}
		return shapes;
	}

	/** Responsibilities: _normalization Python classes conversion_. **/
	private python_shapes(classes: readonly AstClassNode[]): NamedShape[] {
		return classes.map(class_node => ({
			name: class_node.name,
			line: class_node.start + 1,
			fields: class_node.fields.map(field => `${field.name}:${field.type}`),
			base_names: class_node.base_class_names,
		}));
	}

	/** Responsibilities: _reporting duplicate TypeScript type_. **/
	public typescript(source_file: ts.SourceFile): DuplicateTypeShape[] {
		return this.duplicate_groups(this.typescript_shapes(source_file));
	}

	/** Responsibilities: _reporting duplicate Python class_. **/
	public python(classes: readonly AstClassNode[]): DuplicateTypeShape[] {
		return this.duplicate_groups(this.python_shapes(classes));
	}
}
