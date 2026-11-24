import type { ObjectLiteralTypeNameLookupContract } from "src/shared_services_protocols";

/** Responsibilities: _project contract lookup_, _local alias overlay_. **/
export class ObjectLiteralTypeNameLookupSet implements ObjectLiteralTypeNameLookupContract {
	private readonly _project_contract_names: ReadonlySet<string>;
	private readonly _project_interface_names: ReadonlySet<string>;
	private readonly _project_class_names: ReadonlySet<string>;
	private readonly _local_type_aliases: ReadonlySet<string>;
	private readonly _aliases: Set<string>;

	/** Responsibilities: _contract lookup initialization_. **/
	public constructor(
		project_contract_names: ReadonlySet<string>,
		project_interface_names: ReadonlySet<string>,
		project_class_names: ReadonlySet<string>,
		local_type_aliases: ReadonlySet<string>,
	) {
		this._project_contract_names = project_contract_names;
		this._project_interface_names = project_interface_names;
		this._project_class_names = project_class_names;
		this._local_type_aliases = local_type_aliases;
		this._aliases = new Set<string>();
	}

	/** Responsibilities: _contract alias registration_. **/
	public register_alias(name: string): void {
		if (this._aliases.has(name)) {
			return;
		}
		this._aliases.add(name);
	}

	/** Responsibilities: _contract name lookup_. **/
	public contains(name: string): boolean {
		if (this._aliases.has(name)) {
			return true;
		}
		if (this._local_type_aliases.has(name)) {
			return false;
		}
		if (this._project_contract_names.has(name)) {
			return true;
		}
		if (this._project_interface_names.has(name)) {
			return true;
		}
		return this._project_class_names.has(name);
	}
}
