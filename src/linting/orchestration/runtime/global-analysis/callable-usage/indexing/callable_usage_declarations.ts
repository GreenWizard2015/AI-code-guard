import type {
	CallableUsageFile,
	ClassCandidatesContract,
	MatcherClassIndexes,
	TypeCandidatesContract,
} from "src/contracts/types/callable_usage_types";
import type { AstClassNode, AstTypeMemberRecord } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _declaration records_, _matcher class names_. **/
export class CallableUsageDeclarations {
	private readonly _type_candidates: TypeCandidatesContract;
	private readonly _class_candidates: ClassCandidatesContract;

	/** Responsibilities: _type record grouping_. **/
	private append_type_candidate(identity: string, members: AstTypeMemberRecord): void {
		const candidates = this._type_candidates.get(identity);
		if (candidates === undefined) {
			this._type_candidates.set(identity, new Set([members]));
			return;
		}
		candidates.add(members);
	}

	/** Responsibilities: _class record grouping_. **/
	private append_class_candidate(identity: string, class_node: AstClassNode): void {
		const candidates = this._class_candidates.get(identity);
		if (candidates === undefined) {
			this._class_candidates.set(identity, new Set([class_node]));
			return;
		}
		candidates.add(class_node);
	}

	/** Responsibilities: _contract name extraction_. **/
	private contract_names(): Set<string> {
		const names = new Set<string>();
		for (const identity of this._type_candidates.keys()) {
			const separator = identity.lastIndexOf("::");
			if (separator >= 0) {
				names.add(identity.slice(separator + 2));
			}
		}
		return names;
	}

	/** Responsibilities: _declaration candidate storage_. **/
	public constructor() {
		this._type_candidates = new Map();
		this._class_candidates = new Map();
	}

	/** Responsibilities: _production declaration source_. **/
	public append(file: CallableUsageFile): void {
		if (file.ast.references.type_members !== undefined) {
			for (const [name, members] of file.ast.references.type_members) {
				this.append_type_candidate(`${file.file}::${name}`, members);
			}
		}
		for (const class_node of file.ast.source.classes) {
			this.append_class_candidate(`${file.file}::${class_node.identity.name}`, class_node);
		}
	}

	/** Responsibilities: _project type index_. **/
	public type_index(): Map<string, AstTypeMemberRecord> {
		const index = new Map<string, AstTypeMemberRecord>();
		for (const [identity, candidates] of this._type_candidates) {
			for (const candidate of candidates) {
				index.set(identity, candidate);
				break;
			}
		}
		return index;
	}

	/** Responsibilities: _project class index_. **/
	public class_index(): Map<string, AstClassNode> {
		const index = new Map<string, AstClassNode>();
		for (const [identity, candidates] of this._class_candidates) {
			for (const candidate of candidates) {
				index.set(identity, candidate);
				break;
			}
		}
		return index;
	}

	/** Responsibilities: _callable matcher classes_. **/
	public matcher_classes(): MatcherClassIndexes {
		const classes = new Map<string, AstClassNode>();
		const protocol_names = this.contract_names();
		for (const [identity, candidates] of this._class_candidates) {
			for (const class_node of candidates) {
				classes.set(identity, class_node);
				if (class_node.classification.protocol || class_node.classification.type_contract) {
					protocol_names.add(class_node.identity.name);
				}
				break;
			}
		}
		return { classes, protocol_names };
	}
}
