import { relative } from "node:path";
import type { CallableReferenceIdentity } from "src/model/ast/normalized_ast_types";
import type {
	TypeScriptCallReturnsContract,
	TypeScriptInstanceStoreContract,
	TypeScriptPropertyStateContract,
	TypeScriptReferenceQuery,
	TypeScriptReferenceResolutionContract,
} from "src/model/protocols";
import { TypeScriptReferenceOwnerQueryKind, TypeScriptReferenceQueryKind } from "src/model/types";
import { TypeScriptCallReturns } from "src/parser/references/identity/calls/type_script_call_returns";
import { TypeScriptInstanceIndex } from "src/parser/references/identity/instances/type_script_instance_index";
import { TypeScriptImportedPropertyOwner } from "src/parser/references/identity/properties/type_script_imported_property_owner";
import { TypeScriptPropertyState } from "src/parser/references/identity/properties/type_script_property_state";
import type {
	TypeScriptReferenceOwnerResolverContract,
	TypeScriptReferenceOwnershipOptions,
	TypeScriptReferenceStateInitializationContract,
} from "src/parser/references/identity/references/protocols";
import { TypeScriptReferenceExpressionOwner } from "src/parser/references/identity/references/type_script_reference_expression_owner";
import { TypeScriptReferenceIdentity } from "src/parser/references/identity/references/type_script_reference_identity";
import { TypeScriptReferenceStateInitializer } from "src/parser/references/identity/references/type_script_reference_state_initializer";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import type { TypeScriptReferenceOwnershipContract } from "src/typescript_analysis_protocols";
import type ts from "typescript";

/** Responsibilities: _reference ownership_, _callable identity_. **/
export class TypeScriptReferenceOwnership implements TypeScriptReferenceOwnershipContract {
	protected readonly _source_file: ts.SourceFile;
	protected readonly _project_root: string;
	protected readonly _aliases: Map<string, string>;
	protected readonly _function_identities: Map<string, CallableReferenceIdentity>;
	protected readonly _instances: TypeScriptInstanceStoreContract;
	protected readonly _property_state: TypeScriptPropertyStateContract;
	protected readonly _call_returns: TypeScriptCallReturnsContract;
	private readonly _initializer: TypeScriptReferenceStateInitializationContract;
	private readonly _owner_resolver: TypeScriptReferenceOwnerResolverContract;

	/** Responsibilities: _reference dependency assembly_. **/
	public constructor(options: TypeScriptReferenceOwnershipOptions) {
		this._source_file = options.source_file;
		this._project_root = options.project_root;
		this._aliases = new Map<string, string>();
		this._function_identities = new Map<string, CallableReferenceIdentity>();
		this._instances = new TypeScriptInstanceIndex(options.source_file);
		this._call_returns = new TypeScriptCallReturns(
			options.source_file,
			this._aliases,
			options.project_root,
			options.source_files,
			options.source_io,
		);
		this._property_state = new TypeScriptPropertyState(this._aliases, this, this._instances);
		const identity = new TypeScriptReferenceIdentity(
			options.source_file,
			options.project_root,
			options.source_files,
			options.source_io,
		);
		this._initializer = new TypeScriptReferenceStateInitializer({
			source: options,
			state: {
				aliases: this._aliases,
				function_identities: this._function_identities,
				instances: this._instances,
				property_state: this._property_state,
				ownership: this,
			},
		});
		this._owner_resolver = new TypeScriptReferenceExpressionOwner({
			aliases: this._aliases,
			instances: this._instances,
			property_state: this._property_state,
			imported_property_owner: new TypeScriptImportedPropertyOwner(
				options.source_file,
				options.project_root,
				options.source_files,
				options.source_io,
			),
			call_returns: this._call_returns,
			reference_identity: identity,
			this_receiver: new TypeScriptThisReceiver(options.source_file, this._aliases),
			initializer: this._initializer,
		});
	}

	/** Responsibilities: _function reference identity_. **/
	public function_reference(expression: ts.Identifier): CallableReferenceIdentity {
		this._initializer.initialize();
		const imported_identity = this._function_identities.get(expression.text);
		let name = expression.text;
		let target_file = this._source_file.fileName;
		if (imported_identity !== undefined) {
			name = imported_identity.name;
			target_file = imported_identity.target_file;
		}
		return {
			name,
			target_file: relative(this._project_root, target_file).replaceAll("\\", "/"),
		};
	}

	/** Responsibilities: _reference ownership resolution_. **/
	public resolve_reference(query: TypeScriptReferenceQuery): TypeScriptReferenceResolutionContract {
		if (query.kind === TypeScriptReferenceQueryKind.MethodReference) {
			return this._owner_resolver.resolve_method_reference({
				expression: query.expression,
			});
		}
		if (query.kind === TypeScriptReferenceQueryKind.CallOwner) {
			return this._owner_resolver.resolve_owner({
				kind: TypeScriptReferenceOwnerQueryKind.CallOwner,
				expression: query.expression,
			});
		}
		if (query.kind === TypeScriptReferenceQueryKind.PropertyOwner) {
			return this._owner_resolver.resolve_owner({
				kind: TypeScriptReferenceOwnerQueryKind.PropertyOwner,
				expression: query.expression,
			});
		}
		return this._owner_resolver.resolve_owner({
			kind: TypeScriptReferenceOwnerQueryKind.CallOrPropertyOwner,
			expression: query.expression,
		});
	}
}
