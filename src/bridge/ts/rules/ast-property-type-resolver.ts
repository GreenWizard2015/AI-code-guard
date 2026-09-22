import ts from 'typescript';

import { AstPropertySources } from 'src/bridge/ts/rules/ast-property-sources';

/** Responsibilities: _resolution AST property states_. **/
export class AstPropertyType {
	private readonly unbounded_kinds = new Set([
		ts.SyntaxKind.AnyKeyword,
		ts.SyntaxKind.UnknownKeyword,
		ts.SyntaxKind.UndefinedKeyword,
		ts.SyntaxKind.VoidKeyword,
	]);
	private readonly source_file: ts.SourceFile;
	private readonly sources: AstPropertySources;
	private readonly field_states = new Map<string, string>();

	/** Responsibilities: _property name identification_. **/
	private property_name(node: ts.PropertyName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		if (ts.isStringLiteral(node)) {
			return node.text;
		}
		if (ts.isNumericLiteral(node)) {
			return node.text;
		}
		return '';
	}

	/** Responsibilities: _identification undefined type_. **/
	private contains_undefined(type: ts.TypeNode): boolean {
		if (this.unbounded_kinds.has(type.kind)) {
			return true;
		}
		if (ts.isParenthesizedTypeNode(type)) {
			return this.contains_undefined(type.type);
		}
		if (!ts.isUnionTypeNode(type)) {
			return false;
		}
		return type.types.some(item => this.contains_undefined(item));
	}

	/** Responsibilities: _resolution literal property state_. **/
	private literal_state(type: ts.TypeLiteralNode, property: string): string {
		for (const member of type.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (this.property_name(member.name) !== property) {
				continue;
			}
if (member.questionToken !== undefined || member.type === undefined) {
				return 'optional';
			}
			return this.contains_undefined(member.type) ? 'optional' : 'required';
		}
		return 'unknown';
	}

	/** Responsibilities: _resolution intersection property state_. **/
	private intersection_state(type: ts.IntersectionTypeNode, source: ts.SourceFile, property: string, seen: Set<string>): string {
		let found = 'unknown';
		for (const item of type.types) {
			const state = this.type_state(item, source, property, seen);
			if (state === 'required') {
				return state;
			}
			if (state === 'optional') {
				found = state;
			}
		}
		return found;
	}

	/** Responsibilities: _resolution referenced property state_. **/
	private reference_state(type: ts.TypeReferenceNode, source: ts.SourceFile, property: string, seen: Set<string>): string {
		if (!ts.isIdentifier(type.typeName)) {
			return 'unknown';
		}
		const key = this.sources.type_key(source.fileName, type.typeName.text);
		if (!this.reference_available(key, seen)) {
			return 'unknown';
		}
		seen.add(key);
		const declaration_node = this.sources.declaration(key);
		if (declaration_node === undefined) {
			return 'unknown';
		}
		return this.declaration_state(declaration_node, property, seen);
	}

	/** Responsibilities: _identification available type reference_. **/
	private reference_available(key: string, seen: Set<string>): boolean {
		if (key.length === 0) {
			return false;
		}
		if (seen.has(key)) {
			return false;
		}
		return this.sources.declaration_exists(key);
	}

	/** Responsibilities: _resolution declaration property state_. **/
	private declaration_state(declaration_node: ts.Declaration, property: string, seen: Set<string>): string {
		if (ts.isTypeAliasDeclaration(declaration_node)) {
			return this.type_state(declaration_node.type, declaration_node.getSourceFile(), property, seen);
		}
		if (!ts.isInterfaceDeclaration(declaration_node)) {
			return 'unknown';
		}
		return this.interface_state(declaration_node, property);
	}

	/** Responsibilities: _resolution interface property state_. **/
	private interface_state(type: ts.InterfaceDeclaration, property: string): string {
		for (const member of type.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (this.property_name(member.name) === property) {
if (member.questionToken !== undefined || member.type === undefined) {
					return 'optional';
				}
				return this.contains_undefined(member.type) ? 'optional' : 'required';
			}
		}
		return 'unknown';
	}

	/** Responsibilities: _resolution type property state_. **/
	private type_state(type: ts.TypeNode, source: ts.SourceFile, property: string, seen: Set<string>): string {
		if (ts.isParenthesizedTypeNode(type)) {
			return this.type_state(type.type, source, property, seen);
		}
		if (ts.isTypeLiteralNode(type)) {
			return this.literal_state(type, property);
		}
		if (ts.isIntersectionTypeNode(type)) {
			return this.intersection_state(type, source, property, seen);
		}
		if (!ts.isTypeReferenceNode(type)) {
			return 'unknown';
		}
		return this.reference_state(type, source, property, seen);
	}

	/** Responsibilities: _resolution caching field state_. **/
	private field_state(base: string, property: string): string {
		const key = `${base}\u0000${property}`;
		const cached = this.field_states.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const type = this.sources.binding_type(this.source_file.fileName, base);
		const state = this.type_state(type, this.source_file, property, new Set<string>());
		this.field_states.set(key, state);
		return state;
	}

	/** Responsibilities: _initialization AST property type_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.sources = new AstPropertySources(source_file);
	}

	/** Responsibilities: _fields identification requirement_. **/
	public required_field(base: string, property: string): boolean {
		return this.field_state(base, property) === 'required';
	}

	/** Responsibilities: _known fields identification_. **/
	public known_field(base: string, property: string): boolean {
		return this.field_state(base, property) !== 'unknown';
	}
}
