import type {
	FiniteVariantDiscriminantIndex,
	FiniteVariantDiscriminatedUnionIndexContract,
	FiniteVariantEnumIndexContract,
	FiniteVariantImportList,
	FiniteVariantImportNames,
	FiniteVariantIndex,
	FiniteVariantMembers,
	FiniteVariantNodeList,
	FiniteVariantSourceCache,
	FiniteVariantSourceIndex,
} from "src/rules/typescript/syntax-rules/types/types";
import type { RuleContextContract } from "src/types";
import ts from "typescript";

/** Responsibilities: _finite declaration indexing_, _imported type resolution_. **/
export class FiniteVariantDeclarationIndex {
	private readonly _members_index: FiniteVariantIndex;
	private readonly _discriminants_index: FiniteVariantDiscriminantIndex;
	private readonly _imported_source_indexes: FiniteVariantSourceCache;
	private readonly _enum_index: FiniteVariantEnumIndexContract;
	private readonly _discriminated_unions: FiniteVariantDiscriminatedUnionIndexContract;
	public readonly _members_by_type: ReadonlyMap<string, FiniteVariantMembers>;
	public readonly _discriminants_by_type: ReadonlyMap<string, string>;

	/** Responsibilities: _string union member extraction_. **/
	private string_union_members(type_node: ts.TypeNode): FiniteVariantMembers {
		let members: FiniteVariantNodeList = [type_node];
		if (ts.isUnionTypeNode(type_node)) {
			members = type_node.types;
		}
		const values: FiniteVariantMembers = new Set();
		for (const member of members) {
			if (!ts.isLiteralTypeNode(member) || !ts.isStringLiteral(member.literal)) {
				return new Set();
			}
			values.add(member.literal.text);
		}
		return values;
	}

	/** Responsibilities: _single source index_. **/
	private source_members(imported_source_file: ts.SourceFile): FiniteVariantSourceIndex {
		const cached = this._imported_source_indexes.get(imported_source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index: FiniteVariantSourceIndex = { members: new Map(), discriminants: new Map() };
		this._discriminated_unions.reset_source();
		const unions: ts.TypeAliasDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			this.append_source_node(node, index, unions);
			node.forEachChild(visit);
		};
		visit(imported_source_file);
		this._discriminated_unions.append_unions(unions, index);
		this._imported_source_indexes.set(imported_source_file, index);
		return index;
	}

	/** Responsibilities: _finite enum indexing_. **/
	private append_enum(declaration: ts.EnumDeclaration, members_by_type: FiniteVariantIndex): void {
		this._enum_index.read(declaration);
		const names = this._enum_index.members();
		if (names.size > 0) {
			members_by_type.set(declaration.name.text, names);
		}
	}

	/** Responsibilities: _finite type alias indexing_. **/
	private append_type_alias(
		declaration: ts.TypeAliasDeclaration,
		members_by_type: FiniteVariantIndex,
		union_declarations: ts.TypeAliasDeclaration[],
	): void {
		const values = this.string_union_members(declaration.type);
		if (values.size > 0) {
			members_by_type.set(declaration.name.text, values);
		}
		this._discriminated_unions.append_literals(declaration);
		if (ts.isUnionTypeNode(declaration.type)) {
			union_declarations.push(declaration);
		}
	}

	/** Responsibilities: _source finite declarations_. **/
	private append_source_node(
		node: ts.Node,
		index: FiniteVariantSourceIndex,
		union_declarations: ts.TypeAliasDeclaration[],
	): void {
		if (ts.isEnumDeclaration(node)) {
			this.append_enum(node, index.members);
			return;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			this.append_type_alias(node, index.members, union_declarations);
			return;
		}
		if (ts.isInterfaceDeclaration(node)) {
			this._discriminated_unions.append_literals(node);
		}
	}

	/** Responsibilities: _named import specifier lookup_. **/
	private import_elements(named_import: ts.ImportDeclaration): FiniteVariantImportList {
		const clause = named_import.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return [];
		}
		return clause.namedBindings.elements;
	}

	/** Responsibilities: _imported symbol name resolution_. **/
	private imported_symbol(element: ts.ImportSpecifier): string {
		if (element.propertyName === undefined) {
			return element.name.text;
		}
		return element.propertyName.text;
	}

	/** Responsibilities: _named import declarations_. **/
	private imported_names(symbol_import: ts.ImportDeclaration): FiniteVariantImportNames {
		const names: FiniteVariantImportNames = new Map();
		for (const element of this.import_elements(symbol_import)) {
			names.set(element.name.text, this.imported_symbol(element));
		}
		return names;
	}

	/** Responsibilities: _imported source index lookup_. **/
	private imported_index(
		module_import: ts.ImportDeclaration,
		importing_file: ts.SourceFile,
		rule_context: RuleContextContract,
	): FiniteVariantSourceIndex {
		const index: FiniteVariantSourceIndex = { members: new Map(), discriminants: new Map() };
		if (!ts.isStringLiteral(module_import.moduleSpecifier)) {
			return index;
		}
		const imported_file = rule_context
			.state()
			.analysis.module_resolver.module_symbol(importing_file.fileName, module_import.moduleSpecifier.text);
		const imported_source = rule_context.state().analysis.source_resolver.get(imported_file);
		if (imported_source === undefined) {
			return index;
		}
		return this.source_members(imported_source);
	}

	/** Responsibilities: _finite type member indexing_. **/
	private append_import(
		import_candidate: ts.ImportDeclaration,
		importing_file: ts.SourceFile,
		rule_context: RuleContextContract,
	): void {
		const names = this.imported_names(import_candidate);
		const imported_index = this.imported_index(import_candidate, importing_file, rule_context);
		for (const [local_name, imported_name] of names) {
			const values = imported_index.members.get(imported_name);
			if (values !== undefined) {
				this._members_index.set(local_name, values);
			}
			const discriminant = imported_index.discriminants.get(imported_name);
			if (discriminant !== undefined) {
				this._discriminants_index.set(local_name, discriminant);
			}
		}
	}

	/** Responsibilities: _finite declaration index initialization_. **/
	public constructor(
		discriminated_unions: FiniteVariantDiscriminatedUnionIndexContract,
		enum_index: FiniteVariantEnumIndexContract,
	) {
		this._members_index = new Map();
		this._discriminants_index = new Map();
		this._members_by_type = this._members_index;
		this._discriminants_by_type = this._discriminants_index;
		this._imported_source_indexes = new WeakMap();
		this._enum_index = enum_index;
		this._discriminated_unions = discriminated_unions;
	}

	/** Responsibilities: _local type index_. **/
	public append_local(nodes: readonly ts.Node[]): void {
		this._members_index.clear();
		this._discriminants_index.clear();
		const index: FiniteVariantSourceIndex = {
			members: this._members_index,
			discriminants: this._discriminants_index,
		};
		this._discriminated_unions.reset_source();
		const unions: ts.TypeAliasDeclaration[] = [];
		for (const node of nodes) {
			this.append_source_node(node, index, unions);
		}
		this._discriminated_unions.append_unions(unions, index);
	}

	/** Responsibilities: _imported type index_. **/
	public append_imports(import_source_file: ts.SourceFile, context: RuleContextContract): void {
		for (const import_candidate of import_source_file.statements) {
			if (ts.isImportDeclaration(import_candidate)) {
				this.append_import(import_candidate, import_source_file, context);
			}
		}
	}
}
