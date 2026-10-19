import type { CallableClassIndex, CallableDefinition, CallableProjectIndex, ParsedFile } from "src/metrics/types";
import type { AstClassNode, CallableOwnershipRequest, CallableOwnershipResolver } from "src/types";
import type { CallableOwnershipIndexes } from "src/linting/orchestration/runtime/composition/types";
import { CallableOwnershipGraph } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_ownership_graph";

/** Responsibilities: _external method classification_, _ownership resolver construction_. **/
export class CallableOwnership {
	private readonly external_method_kind = "method" as const;

	/** Responsibilities: _callable ownership index construction_. **/
	private indexes(parsed_files: ParsedFile[]): CallableOwnershipIndexes {
		const by_file = new Map<string, ParsedFile>();
		const by_absolute_file = new Map<string, ParsedFile>();
		const classes_by_file = new Map<string, ReadonlyMap<string, AstClassNode>>();
		for (const file of parsed_files) {
			by_file.set(file.file, file);
			by_absolute_file.set(file.absolute_file, file);
			classes_by_file.set(file.file, new Map(file.ast.classes.map((class_node) => [class_node.name, class_node])));
		}
		return { by_file, by_absolute_file, classes_by_file };
	}

	/** Responsibilities: _classification callable belongs externally_. **/
	private external_definition_class(definition: CallableDefinition, indexes: CallableOwnershipIndexes): boolean {
		const file = indexes.by_file.get(definition.file);
		if (file === undefined) {
			return false;
		}
		const classes = indexes.classes_by_file.get(file.file);
		if (classes === undefined || definition.node.owner === undefined) {
			return false;
		}
		const class_node = classes.get(definition.node.owner);
		if (class_node === undefined) {
			return false;
		}
		if (class_node.extends_external_class) {
			return true;
		}
		return this.external_protocol(class_node, definition.file, indexes);
	}

	/** Responsibilities: _classification external protocol inheritance_. **/
	private external_protocol(
		class_node: AstClassNode,
		definition_file: string,
		indexes: CallableOwnershipIndexes,
	): boolean {
		const interfaces = class_node.interfaces;
		if (interfaces === undefined) {
			return false;
		}
		let source = indexes.by_file.get(definition_file);
		if (source === undefined) {
			source = indexes.by_absolute_file.get(definition_file);
		}
		const names = interfaces.map((name) => {
			const alias = source?.ast.reference_aliases.find((item) => item.name === name);
			if (alias !== undefined) {
				return alias.target;
			}
			return name;
		});
		const scope = this.source_scope(definition_file, indexes);
		return names.some((interface_name) => this.has_external_protocol(interface_name, definition_file, scope, indexes));
	}

	/** Responsibilities: _external protocol lookup_. **/
	private has_external_protocol(
		interface_name: string,
		definition_file: string,
		scope: ReadonlySet<string>,
		indexes: CallableOwnershipIndexes,
	): boolean {
		for (const file_name of scope) {
			if (file_name === definition_file) {
				continue;
			}
			const file = indexes.by_file.get(file_name);
			if (file === undefined) {
				continue;
			}
			if (this.has_type_member(file, interface_name)) {
				return true;
			}
			if (this.has_protocol_class(file, interface_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _named type member lookup_. **/
	private has_type_member(file: ParsedFile, interface_name: string): boolean {
		const members = file.ast.type_members;
		if (members === undefined) {
			return false;
		}
		return members.has(interface_name);
	}

	/** Responsibilities: _protocol class lookup_. **/
	private has_protocol_class(file: ParsedFile, interface_name: string): boolean {
		return file.ast.classes.some((item) => {
			if (!item.protocol) {
				return false;
			}
			return item.name === interface_name;
		});
	}

	/** Responsibilities: _source-visible parsed files_. **/
	private append_imported_scope(scope: Set<string>, source: ParsedFile, indexes: CallableOwnershipIndexes): void {
		for (const imported of source.imports) {
			const imported_file = indexes.by_absolute_file.get(imported);
			if (imported_file !== undefined) {
				scope.add(imported_file.file);
			}
		}
	}

	/** Responsibilities: _source-visible parsed files_. **/
	private source_scope(definition_file: string, indexes: CallableOwnershipIndexes): ReadonlySet<string> {
		let source = indexes.by_file.get(definition_file);
		if (source === undefined) {
			source = indexes.by_absolute_file.get(definition_file);
		}
		const scope = new Set<string>();
		if (source === undefined) {
			scope.add(definition_file);
			return scope;
		}
		scope.add(source.file);
		this.append_imported_scope(scope, source, indexes);
		return scope;
	}

	/** Responsibilities: _reporting callable method externally_. **/
	private external_method(
		definition: CallableDefinition,
		indexes: CallableOwnershipIndexes,
		external_class_cache: Map<string, boolean>,
	): boolean {
		if (definition.kind !== this.external_method_kind || definition.node.owner === undefined) {
			return false;
		}
		const key = `${definition.file}\u0000${definition.node.owner}`;
		const cached = external_class_cache.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.external_definition_class(definition, indexes);
		external_class_cache.set(key, result);
		return result;
	}

	/** Responsibilities: _batch external callable classification_. **/
	public external_methods(
		definitions: readonly CallableDefinition[],
		parsed_files: ParsedFile[],
	): ReadonlySet<CallableDefinition> {
		const indexes = this.indexes(parsed_files);
		const methods = new Set<CallableDefinition>();
		const external_class_cache = new Map<string, boolean>();
		for (const definition of definitions) {
			if (this.external_method(definition, indexes, external_class_cache)) {
				methods.add(definition);
			}
		}
		return methods;
	}

	/** Responsibilities: _construction callable ownership resolver_. **/
	public ownership_resolver(
		parsed_files: ParsedFile[],
		project_types: CallableProjectIndex,
		class_nodes: CallableClassIndex,
	): CallableOwnershipResolver {
		const type_map = new Map(project_types);
		const graph = new CallableOwnershipGraph(type_map, class_nodes, parsed_files);
		return (request: CallableOwnershipRequest) =>
			graph.match(request.class_node, request.method_name, request.owner, request.source_file);
	}
}
