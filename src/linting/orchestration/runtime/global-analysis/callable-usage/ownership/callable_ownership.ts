import type { CallableOwnershipIndexes } from "src/contracts/types/composition_types";
import { CallableOwnershipGraph } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_ownership_graph";
import type { CallableClassIndex, CallableDefinition, CallableProjectIndex, ParsedFile } from "src/metrics/types";
import type { AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { CallableOwnershipRequest, CallableOwnershipResolver } from "src/types";

/** Responsibilities: _external method classification_, _ownership resolver construction_. **/
export class CallableOwnership {
	private readonly _external_method_kind: "method";
	private readonly _parsed_files: readonly ParsedFile[];
	private readonly _file_indexes: CallableOwnershipIndexes;

	/** Responsibilities: _classification callable belongs externally_. **/
	private external_definition_class(definition: CallableDefinition): boolean {
		const file = this._file_indexes.by_file.get(definition.file);
		if (file === undefined) {
			return false;
		}
		const owner = definition.node.identity.owner;
		const classes = this._file_indexes.classes_by_file.get(file.file);
		if (classes === undefined || owner.length === 0) {
			return false;
		}
		const class_node = classes.get(owner);
		if (class_node === undefined) {
			return false;
		}
		return this.is_external_class(class_node, definition.file);
	}

	/** Responsibilities: _external class classification_. **/
	private is_external_class(candidate: AstClassNode, source_file: string): boolean {
		if (candidate.classification.extends_external_class) {
			return true;
		}
		return this.external_protocol(candidate, source_file);
	}

	/** Responsibilities: _classification external protocol inheritance_. **/
	private external_protocol(class_node: AstClassNode, definition_file: string): boolean {
		const indexes = this._file_indexes;
		const interfaces = class_node.structure.interfaces;
		let source = indexes.by_file.get(definition_file);
		if (source === undefined) {
			source = indexes.by_absolute_file.get(definition_file);
		}
		const names = interfaces.map((name) => {
			if (source === undefined) {
				return name;
			}
			return this.resolve_type_alias(source.ast, name);
		});
		const scope = this.source_scope(definition_file);
		return names.some((interface_name) => this.has_external_protocol(interface_name, scope));
	}

	/** Responsibilities: _source type alias resolution_. **/
	private resolve_type_alias(ast: NormalizedAstFile, name: string): string {
		const alias = ast.references.reference_aliases.find((item) => item.name === name);
		if (alias === undefined) {
			return name;
		}
		return alias.target;
	}

	/** Responsibilities: _external protocol lookup_. **/
	private has_external_protocol(interface_name: string, scope: ReadonlySet<string>): boolean {
		const indexes = this._file_indexes;
		for (const file_name of scope) {
			const file = indexes.by_file.get(file_name);
			if (file === undefined) {
				continue;
			}
			if (this.declares_protocol(file.ast, interface_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _protocol declaration lookup_. **/
	private declares_protocol(ast: NormalizedAstFile, interface_name: string): boolean {
		const members = ast.references.type_members;
		if (members !== undefined) {
			if (members.has(interface_name)) {
				return true;
			}
		}
		return ast.source.classes.some((item) => {
			if (!item.classification.protocol) {
				return false;
			}
			return item.identity.name === interface_name;
		});
	}

	/** Responsibilities: _source-visible parsed files_. **/
	private append_imported_scope(scope: Set<string>, source: ParsedFile): void {
		const indexes = this._file_indexes;
		for (const imported of source.imports) {
			const imported_file = indexes.by_absolute_file.get(imported);
			if (imported_file !== undefined && imported_file.file !== source.file) {
				scope.add(imported_file.file);
			}
		}
	}

	/** Responsibilities: _source-visible parsed files_. **/
	private source_scope(definition_file: string): ReadonlySet<string> {
		const indexes = this._file_indexes;
		let source = indexes.by_file.get(definition_file);
		if (source === undefined) {
			source = indexes.by_absolute_file.get(definition_file);
		}
		const scope = new Set<string>();
		if (source === undefined) {
			return scope;
		}
		this.append_imported_scope(scope, source);
		return scope;
	}

	/** Responsibilities: _reporting callable method externally_. **/
	private external_method(definition: CallableDefinition, external_class_cache: Map<string, boolean>): boolean {
		const owner = definition.node.identity.owner;
		if (definition.kind !== this._external_method_kind || owner.length === 0) {
			return false;
		}
		const key = `${definition.file}\u0000${owner}`;
		const cached = external_class_cache.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.external_definition_class(definition);
		external_class_cache.set(key, result);
		return result;
	}

	/** Responsibilities: _project callable ownership state_. **/
	public constructor(parsed_files: readonly ParsedFile[], file_indexes: CallableOwnershipIndexes) {
		this._external_method_kind = "method";
		this._parsed_files = parsed_files;
		this._file_indexes = file_indexes;
	}

	/** Responsibilities: _batch external callable classification_. **/
	public external_methods(definitions: readonly CallableDefinition[]): ReadonlySet<CallableDefinition> {
		const methods = new Set<CallableDefinition>();
		const external_class_cache = new Map<string, boolean>();
		for (const definition of definitions) {
			if (this.external_method(definition, external_class_cache)) {
				methods.add(definition);
			}
		}
		return methods;
	}

	/** Responsibilities: _construction callable ownership resolver_. **/
	public ownership_resolver(
		project_types: CallableProjectIndex,
		class_nodes: CallableClassIndex,
	): CallableOwnershipResolver {
		const type_map = new Map(project_types);
		const graph = new CallableOwnershipGraph(type_map, class_nodes, this._parsed_files);
		return (request: CallableOwnershipRequest): boolean => graph.match(request);
	}
}
