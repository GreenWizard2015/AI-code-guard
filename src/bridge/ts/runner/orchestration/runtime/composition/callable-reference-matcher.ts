import type { AstCallableReference, CallableOwnershipResolver } from 'src/types';
import type { CallableMatcherContext, ParsedFile } from 'src/metrics/types';
import type { CallableReferenceIndex } from 'src/metrics/callable-reference-index';

/** Responsibilities: _callable references definitions matching_. **/
export class CallableReferenceMatcher {
	private readonly context: CallableMatcherContext;
	private readonly ownership: CallableOwnershipResolver;
	private readonly definition_owner: string;
	private readonly reference_index: CallableReferenceIndex;

	/** Responsibilities: _classification reference matches requested_. **/
	private matches_reference(reference: AstCallableReference, method_count: number): boolean {
		const { definition } = this.context;
if (definition.kind !== reference.kind || definition.node.name !== reference.name) {
			return false;
		}
		if (definition.kind === 'function' || reference.dynamic) {
			return definition.kind === 'function' || method_count === 1;
		}
		return this.matches_owned_method(reference, method_count);
	}

	/** Responsibilities: _known method reference matching_. **/
	private matches_owned_method(reference: AstCallableReference, method_count: number): boolean {
		const owner = reference.owner;
		if (owner.length === 0) {
			return method_count === 1;
		}
		if (owner === this.definition_owner) {
			return true;
		}
		if (this.matches_definition_class(owner, reference.name)) {
			return true;
		}
		return method_count === 1 && !this.has_known_owner(owner);
	}

	/** Responsibilities: _classification definition class contains_. **/
	private matches_definition_class(owner: string, method_name: string): boolean {
		for (const file of this.context.parsed_files) {
			if (file.file !== this.context.definition.file) {
				continue;
			}
			for (const class_node of file.ast.classes) {
				if (class_node.name === this.definition_owner) {
					return this.ownership(class_node, owner, method_name);
				}
			}
		}
		return false;
	}

	/** Responsibilities: _classification callable owner present_. **/
	private has_known_owner(owner: string): boolean {
		for (const definition of this.context.definitions) {
			if (definition.kind !== 'method') {
				continue;
			}
			if (definition.node.owner === owner) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _selection parsing files containing_. **/
	private reference_candidates(): readonly ParsedFile[] {
		const definition = this.context.definition;
		const definition_kind = definition.kind;
		const definition_name = definition.node.name;
		if (!this.reference_index.callable(definition_kind, definition_name)) {
			return [];
		}
		return this.reference_index.files_for(definition_kind, definition_name);
	}

	/** Responsibilities: _initialization parsing files ownership_. **/
	public constructor(context: CallableMatcherContext) {
		this.context = context;
		this.definition_owner = context.definition.node.owner;
		this.ownership = context.ownership;
		this.reference_index = context.reference_index;
	}

	/** Responsibilities: _classification file references requested_. **/
	public file_references(file: ParsedFile, method_count: number): boolean {
		const references = file.ast.call_references;
		if (references === undefined) {
			return false;
		}
		return references.some(reference => this.matches_reference(reference, method_count));
	}

	/** Responsibilities: _collection external files reference_. **/
	public external_files(
		excluded_file: string,
		method_count: number
	): Set<string> {
		const external_files = new Set<string>();
		for (const file of this.reference_candidates()) {
			if (file.file === excluded_file) {
				continue;
			}
			if (this.file_references(file, method_count)) {
				external_files.add(file.file);
			}
		}
		return external_files;
	}
}
