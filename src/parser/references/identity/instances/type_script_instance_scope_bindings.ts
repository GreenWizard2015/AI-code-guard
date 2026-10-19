import ts from "typescript";

/** Responsibilities: _scope binding storage_, _instance owner lookup_. **/
export class TypeScriptInstanceScopeBindings {
	private readonly values: Map<string, { declaration: ts.Node; owner: string }[]>;

	/** Responsibilities: _scope binding storage initialization_. **/
	public constructor() {
		this.values = new Map<string, { declaration: ts.Node; owner: string }[]>();
	}

	/** Responsibilities: _scope binding storage_. **/
	public add(name: string, declaration: ts.Node, owner: string): void {
		let entries = this.values.get(name);
		if (entries === undefined) {
			entries = [];
			this.values.set(name, entries);
		}
		entries.push({ declaration, owner });
	}

	/** Responsibilities: _scope binding lookup_. **/
	public bindings(name: string): readonly { declaration: ts.Node; owner: string }[] {
		const entries = this.values.get(name);
		if (entries === undefined) {
			return [];
		}
		return entries;
	}
}
