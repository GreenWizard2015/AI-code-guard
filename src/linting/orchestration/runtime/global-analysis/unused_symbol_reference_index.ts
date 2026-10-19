import ts from "typescript";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { ProjectSourceScannerContract } from "src/protocols";
import type { LintSourceRecord } from "src/types";
import type {
	UnusedSymbolDefinition,
	UnusedSymbolFileBuckets,
	UnusedSymbolNameBuckets,
	UnusedSourceImportCache,
	UnusedSourceImportFiles,
} from "src/core/types";
import { PUBLIC_FIELD_KIND } from "src/constants";
import { UnusedSymbolAliasIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_alias_index";
import { UnusedSymbolOwnership } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_ownership";

/** Responsibilities: _unused symbol usage binding_, _import ownership resolution_. **/
export class UnusedSymbolReferenceIndex {
	private readonly references: SourceReferenceIndex<string>;
	private readonly scanner: ProjectSourceScannerContract;
	private readonly available_files: Set<string>;
	private readonly definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
	private readonly definitions_by_name: Map<string, UnusedSymbolNameBuckets>;
	private readonly import_cache: UnusedSourceImportCache;
	private readonly alias_index: UnusedSymbolAliasIndex;
	private readonly ownership: UnusedSymbolOwnership;

	/** Responsibilities: _definition name bucket preparation_. **/
	private definition_name_buckets(): UnusedSymbolFileBuckets {
		const buckets = new Map<string, Map<string, UnusedSymbolDefinition[]>>();
		for (const [file, definitions] of this.definitions_by_file) {
			const names = new Map<string, UnusedSymbolDefinition[]>();
			for (const definition of definitions) {
				let matching = names.get(definition.name);
				if (matching === undefined) {
					matching = [];
					names.set(definition.name, matching);
				}
				matching.push(definition);
			}
			buckets.set(file, names);
		}
		return buckets;
	}

	/** Responsibilities: _source import cache_. **/
	private source_imports(source: LintSourceRecord): ReadonlySet<string> {
		const cached = this.import_cache.get(source.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this.scanner.resolved_imports(source.absolute_path, this.available_files);
		this.import_cache.set(source.absolute_path, resolved);
		return resolved;
	}

	/** Responsibilities: _imported symbol usage binding_. **/
	private add_imported_references(source: LintSourceRecord, name: string, imported_file: string, line: number): void {
		const definitions = this.definitions_by_name.get(imported_file);
		if (definitions === undefined) {
			return;
		}
		for (const reference_name of this.alias_index.names(source, name)) {
			const matching = definitions.get(reference_name);
			if (matching === undefined) {
				continue;
			}
			for (const definition of matching) {
				this.references.add_usage(`${definition.file}\u0000${definition.name}`, {
					file: source.relative_path,
					line,
				});
			}
		}
	}

	/** Responsibilities: _source usage indexing_. **/
	private add_source_reference(source: LintSourceRecord, name: string, line: number): void {
		if (this.ownership.parameter_shadow(source, name, line)) {
			return;
		}
		for (const reference_name of this.alias_index.names(source, name)) {
			this.references.add_usage(`${source.relative_path}\u0000${reference_name}`, {
				file: source.relative_path,
				line,
			});
		}
		for (const imported_file of this.source_imports(source)) {
			this.add_imported_references(source, name, imported_file, line);
		}
	}

	/** Responsibilities: _field usage reference insertion_. **/
	private add_field_usage(
		source: LintSourceRecord,
		source_file: ts.SourceFile,
		receiver: ts.Expression,
		name: string,
		position: number,
	): void {
		const owners = this.ownership.property_usage_owners(source, source_file, receiver, name);
		const line = source_file.getLineAndCharacterOfPosition(position).line + 1;
		for (const owner of owners) {
			const key = `field\u0000${owner.file}\u0000${owner.owner}\u0000${name}`;
			this.references.add_usage(key, { file: source.relative_path, line });
		}
	}

	/** Responsibilities: _property access references_. **/
	private property_usage(source: LintSourceRecord, source_file: ts.SourceFile, node: ts.Node): void {
		if (ts.isPropertyAccessExpression(node)) {
			this.add_field_usage(source, source_file, node.expression, node.name.text, node.name.getStart(source_file));
			return;
		}
		if (!ts.isElementAccessExpression(node)) {
			return;
		}
		const argument = node.argumentExpression;
		if (argument === undefined) {
			return;
		}
		if (ts.isStringLiteral(argument)) {
			this.add_field_usage(source, source_file, node.expression, argument.text, argument.getStart(source_file));
		}
	}

	/** Responsibilities: _TypeScript property usage traversal_. **/
	private property_usages(source: LintSourceRecord): void {
		if (!source.typescript()) {
			return;
		}
		const source_file = source.typescript_ast.source_file_node();
		const visit = (node: ts.Node): void => {
			this.property_usage(source, source_file, node);
			if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
				if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) {
					this.add_field_usage(source, source_file, node.parent, node.name.text, node.name.getStart(source_file));
				}
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _field contract usage presence_. **/
	private field_usage_present(definition: UnusedSymbolDefinition): boolean {
		const field_key = `field\u0000${definition.file}\u0000${definition.owner}\u0000${definition.name}`;
		if (this.references.references_for(field_key, "usage").length > 0) {
			return true;
		}
		for (const owner of this.ownership.contract_fields(definition)) {
			const key = `field\u0000${owner.file}\u0000${owner.owner}\u0000${definition.name}`;
			if (this.references.references_for(key, "usage").length > 0) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _unused symbol index state_. **/
	public constructor(
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		this.references = new SourceReferenceIndex<string>();
		this.scanner = scanner;
		this.available_files = available_files;
		this.definitions_by_file = definitions_by_file;
		this.definitions_by_name = new Map<string, UnusedSymbolNameBuckets>();
		this.import_cache = new Map<string, UnusedSourceImportFiles>();
		this.alias_index = new UnusedSymbolAliasIndex();
		this.ownership = new UnusedSymbolOwnership(scanner, available_files, definitions_by_file, this.import_cache);
	}

	/** Responsibilities: _definition name index preparation_. **/
	public prepare(): void {
		for (const [file, names] of this.definition_name_buckets()) {
			this.definitions_by_name.set(file, names);
		}
	}

	/** Responsibilities: _unused symbol implementation indexing_. **/
	public add_implementation(definition: UnusedSymbolDefinition): void {
		this.references.add_implementation(`${definition.file}\u0000${definition.name}`, {
			file: definition.file,
			line: definition.line,
		});
		if (definition.kind === PUBLIC_FIELD_KIND) {
			const key = `field\u0000${definition.file}\u0000${definition.owner}\u0000${definition.name}`;
			this.references.add_implementation(key, { file: definition.file, line: definition.line });
		}
	}

	/** Responsibilities: _source usage collection_. **/
	public add_source(source: LintSourceRecord): void {
		this.alias_index.add_source(source);
		const references = source.normalized_ast.symbol_references;
		if (Array.isArray(references)) {
			for (const reference of references) {
				this.add_source_reference(source, reference.name, reference.line + 1);
			}
		}
		this.property_usages(source);
	}

	/** Responsibilities: _unused symbol reference presence_. **/
	public usage_present(definition: UnusedSymbolDefinition): boolean {
		const exact_key = `${definition.file}\u0000${definition.name}`;
		if (this.references.references_for(exact_key, "usage").length > 0) {
			return true;
		}
		if (definition.kind !== PUBLIC_FIELD_KIND) {
			return false;
		}
		return this.field_usage_present(definition);
	}
}
