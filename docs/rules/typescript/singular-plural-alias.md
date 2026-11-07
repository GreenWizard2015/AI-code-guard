# `singular-plural-alias`

Description: A pair such as `base_class_name?: T` and `base_class_names?: T[]` can encode one
alias relationship through two optional representations.


Fix: Check the alias resolution boundary and keep one explicit representation, or resolve the
defining type before storing both fields.

## Bad

```ts
// File: src/types.ts
export type AstNodeFields = {
	base_class_name?: string;
	base_class_names?: string[]; // <- error
};
// File: src/ast_node.ts
import type { AstNodeFields } from "src/types";

/** Responsibilities: _syntax node representation_. **/
export class AstNode {
	private readonly fields: AstNodeFields;
	/** Responsibilities: _node initialization_. **/
	public constructor(fields: AstNodeFields) {
		this.fields = fields;
	}
	/** Responsibilities: _base class alias resolution_. **/
	public resolved_base_classes(): string {
		const base_class_names = this.fields.base_class_names ?? [];
		const base_class_name = this.fields.base_class_name ?? "";
		const joined_names = base_class_names
			.map((name) => name.trim())
			.filter((name) => name.length > 0)
			.join(", ");
		const primary_name = base_class_name.trim();
		return `${primary_name} (${joined_names})`;
	}
	/** Responsibilities: _node summary formatting_. **/
	public summary(): string {
		const resolved_names = this.resolved_base_classes();
		const declared_count = (this.fields.base_class_names ?? []).length;
		return `Base classes: ${resolved_names} (${declared_count} declared)`;
	}
	/** Responsibilities: _base class membership_. **/
	public contains_base_class(base_class_name: string): boolean {
		const target_name = base_class_name.trim();
		for (const name of this.fields.base_class_names ?? []) {
			if (name.trim() === target_name) { return true; }
		}
		return false;
	}
	/** Responsibilities: _node identity formatting_. **/
	public identity_label(): string {
		return `${this.fields.base_class_name ?? ""}: ${this.resolved_base_classes()}`;
	}
	/** Responsibilities: _base class count_. **/
	public base_class_count(): number {
		const distinct_names = new Set((this.fields.base_class_names ?? []).map((name) => name.trim()));
		const populated_names = [...distinct_names].filter((name) => name.length > 0);
		return populated_names.length;
	}
	/** Responsibilities: _node report output_. **/
	public report(): void {
		console.log(`${this.identity_label()} | ${this.summary()} | ${this.contains_base_class("Entity")}`);
	}
}
// File: cli.ts
import { AstNode } from "src/ast_node";

(() => {
	const node = new AstNode({ base_class_name: "Entity", base_class_names: ["Entity"] });
	node.report();
})();
```

## Good

```ts
// File: src/type_declaration.ts
/** Responsibilities: _type declaration inheritance_. **/
export class TypeDeclaration {
	private readonly _base_class_names: readonly string[];
	/** Responsibilities: _type declaration initialization_. **/
	public constructor(base_class_names: readonly string[]) {
		this._base_class_names = base_class_names;
	}
	/** Responsibilities: _base class name formatting_. **/
	public format_names(): string {
		return this._base_class_names.map((name) => name.trim()).join(", ");
	}
	/** Responsibilities: _declared base class counting_. **/
	public declared_count(): number {
		return this._base_class_names.length;
	}
	/** Responsibilities: _distinct base class counting_. **/
	public distinct_count(): number {
		const unique_names = new Set(this._base_class_names);
		return unique_names.size;
	}
	/** Responsibilities: _inheritance summary formatting_. **/
	public summary(): string {
		const distinct_count = this.distinct_count();
		const declared_count = this.declared_count();
		const names_text = this.format_names();
		return `${distinct_count} distinct of ${declared_count}: ${names_text}`;
	}
	/** Responsibilities: _inheritance report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { TypeDeclaration } from "src/type_declaration";

(() => {
	const declaration = new TypeDeclaration(["Entity", "Serializable"]);
	declaration.report();
})();
```
