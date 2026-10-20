import type { ContractNameAliasLookupContract } from "src/shared_services_protocols";

/** Responsibilities: _project contract lookup_, _local alias overlay_. **/
export class ContractNameLookupSet implements ContractNameAliasLookupContract {
	private readonly project_contract_names: ReadonlySet<string>;
	private readonly project_interface_names: ReadonlySet<string>;
	private readonly project_class_names: ReadonlySet<string>;
	private readonly local_type_aliases: ReadonlySet<string>;
	private readonly aliases: Set<string>;

	/** Responsibilities: _project contract name lookup_. **/
	private project_name(name: string): boolean {
		if (this.project_contract_names.has(name)) {
			return true;
		}
		if (this.project_interface_names.has(name)) {
			return true;
		}
		return this.project_class_names.has(name);
	}

	/** Responsibilities: _contract lookup initialization_. **/
	public constructor(
		project_contract_names: ReadonlySet<string>,
		project_interface_names: ReadonlySet<string>,
		project_class_names: ReadonlySet<string>,
		local_type_aliases: ReadonlySet<string>,
	) {
		this.project_contract_names = project_contract_names;
		this.project_interface_names = project_interface_names;
		this.project_class_names = project_class_names;
		this.local_type_aliases = local_type_aliases;
		this.aliases = new Set<string>();
	}

	/** Responsibilities: _contract alias registration_. **/
	public register_alias(name: string): void {
		if (this.aliases.has(name)) {
			return;
		}
		this.aliases.add(name);
	}

	/** Responsibilities: _contract name lookup_. **/
	public contains(name: string): boolean {
		if (this.aliases.has(name)) {
			return true;
		}
		return this.project_name(name) && !this.local_type_aliases.has(name);
	}
}
