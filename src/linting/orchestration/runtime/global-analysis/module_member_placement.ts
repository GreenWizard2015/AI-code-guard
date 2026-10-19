import {
	MODULE_CLASS_KIND,
	MODULE_CONSTANT_KIND,
	MODULE_INTERFACE_KIND,
	MODULE_PROTOCOL_KIND,
	MODULE_TYPE_KIND,
	MODULE_VARIABLE_KIND,
} from "src/constants";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import type { LintProjectContextContract, PlacementSupportContract } from "src/protocols";
import type { NamedSymbol, NormalizedAstFile } from "src/types";

/** Responsibilities: _module member classification_, _destination path resolution_. **/
export class ModuleMemberPlacement {
	private readonly root: string;
	private readonly context: LintProjectContextContract;
	private readonly placement_support: PlacementSupportContract;

	/** Responsibilities: _member description insertion_. **/
	private append(members: string[], names: Set<string>, kind: string, name: string, location: string): void {
		const key = `${kind}:${name}`;
		if (names.has(key)) {
			return;
		}
		names.add(key);
		members.push(`${kind} ${name} -> ${location}`);
	}

	/** Responsibilities: _class member destinations_. **/
	private classes(
		ast: NormalizedAstFile,
		locations: ReadonlyMap<string, string>,
		members: string[],
		names: Set<string>,
	): void {
		for (const node of ast.classes) {
			let kind = MODULE_CLASS_KIND;
			if (node.protocol) {
				kind = MODULE_PROTOCOL_KIND;
			} else if (node.type_contract) {
				kind = MODULE_INTERFACE_KIND;
			}
			const location = locations.get(kind);
			if (location !== undefined) {
				this.append(members, names, kind, node.name, location);
			}
		}
	}

	/** Responsibilities: _type member destinations_. **/
	private types(
		ast: NormalizedAstFile,
		locations: ReadonlyMap<string, string>,
		members: string[],
		names: Set<string>,
	): void {
		for (const declaration of ast.type_declarations) {
			const location = locations.get(MODULE_TYPE_KIND);
			if (location === undefined) {
				continue;
			}
			this.append(members, names, MODULE_TYPE_KIND, declaration.name, location);
		}
	}

	/** Responsibilities: _named symbol kind_. **/
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
	private named(
		ast: NormalizedAstFile,
		locations: ReadonlyMap<string, string>,
		members: string[],
		names: Set<string>,
	): void {
		for (const symbol of ast.named_symbols) {
			const kind = this.named_kind(symbol);
			if (kind.length === 0) {
				continue;
			}
			const location = locations.get(kind);
			if (location !== undefined) {
				this.append(members, names, kind, symbol.name, location);
			}
		}
	}

	/** Responsibilities: _module member placement initialization_. **/
	public constructor(root: string, context: LintProjectContextContract, placement_support: PlacementSupportContract) {
		this.root = root;
		this.context = context;
		this.placement_support = placement_support;
	}

	/** Responsibilities: _member destination index_. **/
	public destinations(target: string, importers: string[]): ReadonlyMap<string, string> {
		const kinds = [
			MODULE_CLASS_KIND,
			MODULE_INTERFACE_KIND,
			MODULE_PROTOCOL_KIND,
			MODULE_TYPE_KIND,
			MODULE_CONSTANT_KIND,
			MODULE_VARIABLE_KIND,
			MODULE_FUNCTION_KIND,
		];
		const locations = new Map<string, string>();
		for (const kind of kinds) {
			locations.set(kind, this.placement_support.suggested_member_location(this.root, target, importers, kind));
		}
		return locations;
	}

	/** Responsibilities: _module member descriptions_. **/
	public descriptions(target: string, importers: string[]): string {
		const ast = this.context.source_record(target).normalized_ast;
		const locations = this.destinations(target, importers);
		const members: string[] = [];
		const names = new Set<string>();
		this.classes(ast, locations, members, names);
		this.types(ast, locations, members, names);
		this.named(ast, locations, members, names);
		if (members.length === 0) {
			return "module exports";
		}
		return members.sort().join(", ");
	}
}
