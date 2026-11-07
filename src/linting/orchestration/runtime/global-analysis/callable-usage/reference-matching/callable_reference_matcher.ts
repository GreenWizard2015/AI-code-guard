import { MIN_USAGE_FILES } from "src/constants";
import { CallableReferenceMatch } from "src/linting/orchestration/runtime/global-analysis/callable-usage/reference-matching/callable_reference_match";
import type {
	CallableMatcherContext,
	CallableMatcherIndexes,
	CallableReferencesByFile,
	MethodOwnerReferenceView,
	ParsedFile,
	SharedCallableKind,
} from "src/metrics/types";
import type { AstCallableNode, AstCallableReference, AstClassNode } from "src/model/ast/normalized_ast_types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import type { CallableReferenceMatcherContract, SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { SourceReference } from "src/source_types";

/** Responsibilities: _callable reference matching_, _external target resolution_. **/
export class CallableReferenceMatcher implements CallableReferenceMatcherContract {
	private readonly _context: CallableMatcherContext;
	private readonly _definition_target_reference: string;
	private readonly _definition_unresolved_reference: string;
	private readonly _definition_node: AstCallableNode;
	private readonly _definition_kind: SharedCallableKind;
	private readonly _reference_index: SourceReferenceIndexContract<string>;
	private readonly _references_by_file: CallableReferencesByFile;
	private readonly _matcher_indexes: CallableMatcherIndexes;
	private readonly _candidate_files: Map<string, ParsedFile>;

	/** Responsibilities: _selection parsing files containing_. **/
	private reference_candidates(): readonly ParsedFile[] {
		const definition = this._context.callable.definition;
		const definition_kind = definition.kind;
		const definition_name = definition.node.identity.name;
		const exact = this._reference_index.references_for(
			`${definition_kind}:${definition.file}:${definition_name}`,
			"usage",
		);
		if (definition_kind === MODULE_FUNCTION_KIND) {
			return this.reference_files(exact);
		}
		const unresolved = this._reference_index.references_for(`${definition_kind}::${definition_name}`, "usage");
		this.reference_files([...exact, ...unresolved, ...this.inherited_owner_references()]);
		this.index_contract_files(definition_name);
		return [...this._candidate_files.values()];
	}

	/** Responsibilities: _contract method candidate files_. **/
	private index_contract_files(definition_name: string): void {
		for (const file of this._matcher_indexes.contract_method_files.get(definition_name) ?? []) {
			this._candidate_files.set(file.file, file);
		}
	}

	/** Responsibilities: _polymorphic base-call reference lookup_. **/
	private inherited_owner_references(): SourceReference[] {
		const definition = this._context.callable.definition;
		const owner = definition.node.identity.owner;
		const class_node = this._matcher_indexes.classes.get(`${definition.file}::${owner}`);
		if (class_node === undefined) {
			return [];
		}
		const owners = this._matcher_indexes.method_owner_references.get(definition.node.identity.name);
		if (owners === undefined) {
			return [];
		}
		return this.inherited_references(owner, class_node, owners);
	}

	/** Responsibilities: _inherited reference lookup_. **/
	private inherited_references(
		owner: string,
		class_node: AstClassNode,
		owners: MethodOwnerReferenceView,
	): SourceReference[] {
		const references: SourceReference[] = [];
		for (const [candidate_owner, owner_references] of owners) {
			if (candidate_owner === owner) {
				continue;
			}
			this.append_owner_references(references, owner_references, class_node, candidate_owner);
		}
		return references;
	}

	/** Responsibilities: _inherited callable references_. **/
	private append_owner_references(
		references: SourceReference[],
		owner_references: readonly SourceReference[],
		class_node: AstClassNode,
		candidate_owner: string,
	): void {
		const definition = this._context.callable.definition;
		for (const reference of owner_references) {
			const inherited = this._context.references.ownership({
				class_node,
				owner: candidate_owner,
				method_name: definition.node.identity.name,
				definition_file: definition.file,
				source_file: reference.file,
			});
			if (inherited) {
				references.push(reference);
			}
		}
	}

	/** Responsibilities: _source reference file resolution_. **/
	private reference_files(references: readonly SourceReference[]): readonly ParsedFile[] {
		this._candidate_files.clear();
		for (const reference of references) {
			const file = this._matcher_indexes.files_by_name.get(reference.file);
			if (file !== undefined) {
				this._candidate_files.set(file.file, file);
			}
		}
		return [...this._candidate_files.values()];
	}

	/** Responsibilities: _file callable references_. **/
	private file_reference_values(file: ParsedFile): readonly AstCallableReference[] {
		const references_by_name = this._references_by_file.get(file.file);
		if (references_by_name === undefined) {
			return [];
		}
		const target_references = references_by_name.get(this._definition_target_reference) ?? [];
		const unresolved_references = references_by_name.get(this._definition_unresolved_reference) ?? [];
		const owned_references = references_by_name.owned_references(
			this._definition_kind,
			this._definition_node.identity.name,
		);
		return [...target_references, ...unresolved_references, ...owned_references];
	}

	/** Responsibilities: _initialization parsing files ownership_. **/
	public constructor(context: CallableMatcherContext) {
		this._candidate_files = new Map<string, ParsedFile>();
		const definition = context.callable.definition;
		this._context = context;
		this._definition_node = definition.node;
		this._definition_kind = definition.kind;
		this._definition_target_reference = `${definition.kind}:${definition.file}:${this._definition_node.identity.name}`;
		this._definition_unresolved_reference = `${definition.kind}::${this._definition_node.identity.name}`;
		this._reference_index = context.references.reference_index;
		this._references_by_file = context.references.references_by_file;
		this._matcher_indexes = context.project.matcher_indexes;
	}

	/** Responsibilities: _classification file references requested_. **/
	public file_references(file: ParsedFile, method_count: number): boolean {
		const references = this.file_reference_values(file);
		for (const reference of references) {
			const match = new CallableReferenceMatch(this._context, reference, method_count, file.file);
			if (match.matches()) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _collection external files reference_. **/
	public external_files(
		excluded_file: string,
		method_count: number,
		candidate_files: ReadonlySet<string>,
	): Set<string> {
		const external_files = new Set<string>();
		for (const file of this.reference_candidates()) {
			if (file.file === excluded_file) {
				continue;
			}
			if (!candidate_files.has(file.file)) {
				continue;
			}
			if (this.file_references(file, method_count)) {
				external_files.add(file.file);
				if (external_files.size >= MIN_USAGE_FILES) {
					return external_files;
				}
			}
		}
		return external_files;
	}
}
