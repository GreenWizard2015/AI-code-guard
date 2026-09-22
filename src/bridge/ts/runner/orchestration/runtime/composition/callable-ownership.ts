import type { CallableClassIndex, CallableDefinition, CallableProjectIndex, ParsedFile } from 'src/metrics/types';
import type { AstClassNode, CallableOwnershipResolver } from 'src/types';
import { CallableOwnershipGraph } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-ownership-graph';
import type { TypeMemberEntry } from 'src/bridge/ts/runtime/types';

/** Responsibilities: _classification callable ownership through_. **/
export class CallableOwnership {
	private readonly external_method_kind = 'method' as const;

	/** Responsibilities: _classification callable belongs externally_. **/
	private external_definition_class(definition: CallableDefinition, parsed_files: ParsedFile[]): boolean {
		for (const file of parsed_files) {
			if (file.file !== definition.file) {
				continue;
			}
			const class_node = file.ast.classes.find(item => item.name === definition.node.owner);
			if (class_node !== undefined) {
return class_node.extends_external_class || this.external_protocol(class_node, definition.file, parsed_files);
			}
		}
		return false;
	}

	/** Responsibilities: _classification callable declared external_. **/
	private external_protocol(class_node: AstClassNode, definition_file: string, parsed_files: ParsedFile[]): boolean {
		const interfaces = class_node.interfaces;
		if (interfaces === undefined) {
			return false;
		}
		return interfaces.some(interface_name => parsed_files.some(file =>
			file.file !== definition_file && file.ast.type_members?.[interface_name] !== undefined
		));
	}

	/** Responsibilities: _classification project protocol defines_. **/
	private protocol_defines_method(parsed_files: ParsedFile[], owner: string, method_name: string): boolean {
		if (owner.length === 0) {
			return false;
		}
		return parsed_files.some(file => file.ast.classes.some(class_node =>
			class_node.protocol && class_node.name === owner &&
			class_node.methods.some(method => method.name === method_name)
		));
	}

	/** Responsibilities: _reporting callable method externally_. **/
	public external_method(definition: CallableDefinition, parsed_files: ParsedFile[]): boolean {
if (definition.kind !== this.external_method_kind || definition.node.owner === undefined) {
			return false;
		}
		return this.external_definition_class(definition, parsed_files);
	}

	/** Responsibilities: _construction callable ownership resolver_. **/
	public ownership_resolver(parsed_files: ParsedFile[], project_types: CallableProjectIndex, class_nodes: CallableClassIndex): CallableOwnershipResolver {
		const entries: TypeMemberEntry[] = [];
		for (const file of parsed_files) {
			if (file.ast.type_members !== undefined) {
				for (const [name, members] of Object.entries(file.ast.type_members)) {
					entries.push({ name, members });
				}
			}
		}
		const type_map = new Map(project_types);
		for (const entry of entries.reverse()) {
			type_map.set(entry.name, entry.members);
		}
		const graph = new CallableOwnershipGraph(type_map, class_nodes);
		return (class_node, owner, method_name) => {
			if (this.protocol_defines_method(parsed_files, owner, method_name)) {
				return true;
			}
			return graph.match(class_node, method_name, owner);
		};
	}
}
