import type {
	ASTNodeVerificationContract,
	ASTVerifierNodeGroupContract,
	ASTVerifierNodeRegistrationContract,
} from "src/ast_verifier_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type ts from "typescript";

/** Responsibilities: _same-verifier path grouping_, _node verifier selection_. **/
export class ASTVerifierNodeGroup implements ASTVerifierNodeGroupContract {
	private readonly _verifier: ASTNodeVerificationContract;
	private readonly _registrations: ASTVerifierNodeRegistrationContract[];

	/** Responsibilities: _path match_. **/
	private matches_node(node: ts.Node): boolean {
		for (const registration of this._registrations) {
			if (registration.kind_only()) {
				return true;
			}
			if (registration.matches_node(node)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _verifier path grouping initialization_. **/
	public constructor(verifier: ASTNodeVerificationContract, registration: ASTVerifierNodeRegistrationContract) {
		this._verifier = verifier;
		this._registrations = [registration];
	}

	/** Responsibilities: _verifier identity matching_. **/
	public shares_verifier(verifier: ASTNodeVerificationContract): boolean {
		return this._verifier === verifier;
	}

	/** Responsibilities: _same-verifier registration collection_. **/
	public append_registration(registration: ASTVerifierNodeRegistrationContract): void {
		if (registration.kind_only()) {
			this._registrations.unshift(registration);
			return;
		}
		this._registrations.push(registration);
	}

	/** Responsibilities: _matching verifier selection_. **/
	public append_match(node: ts.Node, selected: ASTNodeVerificationContract[]): void {
		if (this.matches_node(node)) {
			selected.push(this._verifier);
		}
	}

	/** Responsibilities: _matched verifier execution_. **/
	public verify_if_match(request: TypeScriptNodeVerificationRequest): boolean {
		if (!this.matches_node(request.node)) {
			return false;
		}
		this._verifier.verify(request);
		return true;
	}
}
