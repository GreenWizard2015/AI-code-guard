import type {
	AstCallableReference,
	CallableReferenceIdentity,
	CallableReferenceKind,
} from "src/model/ast/normalized_ast_types";
import type { TypeScriptReferenceResolutionContract } from "src/model/protocols";

/** Responsibilities: _reference ownership_, _callable identity_. **/
export class TypeScriptReferenceResolution implements TypeScriptReferenceResolutionContract {
	private readonly _reference_owner: string;
	private readonly _reference_identity: CallableReferenceIdentity;

	/** Responsibilities: _reference ownership data_. **/
	public constructor(owner: string, name = "", target_file = "") {
		this._reference_owner = owner;
		this._reference_identity = { name, target_file };
	}

	/** Responsibilities: _reference ownership_. **/
	public owner(): string {
		return this._reference_owner;
	}

	/** Responsibilities: _callable reference identity_. **/
	public identity(): CallableReferenceIdentity {
		return this._reference_identity;
	}

	/** Responsibilities: _callable reference record construction_. **/
	public callable_reference(kind: CallableReferenceKind, line: number): AstCallableReference {
		return {
			name: this._reference_identity.name,
			kind,
			target_file: this._reference_identity.target_file,
			owner: this._reference_owner,
			caller_owner: "",
			is_call: false,
			dynamic: false,
			line,
			call_use: {
				assigned_name: "",
				assigned_type_name: "",
				callee_name: "",
				receiver_name: "",
				receiver_constructor_name: "",
				deferred: false,
			},
		};
	}
}
