import {
	MODULE_CLASS_KIND,
	MODULE_CONSTANT_KIND,
	MODULE_INTERFACE_KIND,
	MODULE_PROTOCOL_KIND,
	MODULE_TYPE_KIND,
	MODULE_VARIABLE_KIND,
} from "src/constants";
import type { NamedSymbol, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _module member description collection_, _destination ownership_. **/
export class ModuleMemberDescription {
	private readonly _ast: NormalizedAstFile;
	private readonly _locations: ReadonlyMap<string, string>;
	private readonly _members: string[];
	private readonly _names: Set<string>;

	/** Responsibilities: _member description insertion_. **/
	private append(kind: string, name: string, location: string): void {
		const key = `${kind}:${name}`;
		if (this._names.has(key)) {
			return;
		}
		this._names.add(key);
		this._members.push(`${kind} ${name} -> ${location}`);
	}

	/** Responsibilities: _class member destinations_. **/
	private append_classes(): void {
		for (const node of this._ast.source.classes) {
			let kind = MODULE_CLASS_KIND;
			if (node.classification.protocol) {
				kind = MODULE_PROTOCOL_KIND;
			} else if (node.classification.type_contract) {
				kind = MODULE_INTERFACE_KIND;
			}
			const location = this._locations.get(kind);
			if (location !== undefined) {
				this.append(kind, node.identity.name, location);
			}
		}
	}

	/** Responsibilities: _type member destinations_. **/
	private append_types(): void {
		for (const declaration of this._ast.references.type_declarations) {
			const location = this._locations.get(MODULE_TYPE_KIND);
			if (location === undefined) {
				continue;
			}
			this.append(MODULE_TYPE_KIND, declaration.name, location);
		}
	}

	/** Responsibilities: _named member kind_. **/
	private named_kind(symbol: NamedSymbol): string {
		if (symbol.is_module_constant) {
			return MODULE_CONSTANT_KIND;
		}
		if (symbol.is_module_variable) {
			return MODULE_VARIABLE_KIND;
		}
		if (symbol.is_module_function) {
			return MODULE_FUNCTION_KIND;
		}
		return "";
	}

	/** Responsibilities: _named member destinations_. **/
	private append_named(): void {
		for (const symbol of this._ast.references.named_symbols) {
			const kind = this.named_kind(symbol);
			if (kind.length === 0) {
				continue;
			}
			const location = this._locations.get(kind);
			if (location !== undefined) {
				this.append(kind, symbol.name, location);
			}
		}
	}

	/** Responsibilities: _module member description initialization_. **/
	public constructor(ast: NormalizedAstFile, locations: ReadonlyMap<string, string>) {
		this._ast = ast;
		this._locations = locations;
		this._members = [];
		this._names = new Set<string>();
	}

	/** Responsibilities: _member description collection_. **/
	public collect(): readonly string[] {
		this.append_classes();
		this.append_types();
		this.append_named();
		return this._members;
	}

	/** Responsibilities: _module member description_. **/
	public description(): string {
		const members = this.collect();
		if (members.length === 0) {
			return "module exports";
		}
		const sorted_members = [...members];
		sorted_members.sort();
		return sorted_members.join(", ");
	}
}
