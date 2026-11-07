import type {
	CallableMatchingAliasFields,
	CallableNamedFieldIndex,
} from "src/rules/typescript/syntax-rules/types/types";
import ts from "typescript";

/** Responsibilities: _inherited alias-pair detection_, _inherited interface field lookup_. **/
export class TypeScriptInheritedAliasPairs {
	private readonly _named_fields: CallableNamedFieldIndex;
	private readonly _has_matching_types: CallableMatchingAliasFields;

	/** Responsibilities: _interface heritage lookup_. **/
	private heritage_types(parent_contract: ts.InterfaceDeclaration): readonly ts.ExpressionWithTypeArguments[] {
		if (parent_contract.heritageClauses === undefined) {
			return [];
		}
		for (const clause of parent_contract.heritageClauses) {
			if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
				return clause.types;
			}
		}
		return [];
	}

	/** Responsibilities: _same-file interface name lookup_. **/
	private named_interfaces(source_file: ts.SourceFile, interface_name: string): readonly ts.InterfaceDeclaration[] {
		const matches: ts.InterfaceDeclaration[] = [];
		const visit = (candidate: ts.Node): void => {
			if (ts.isInterfaceDeclaration(candidate) && candidate.name.text === interface_name) {
				matches.push(candidate);
			}
			ts.forEachChild(candidate, visit);
		};
		visit(source_file);
		return matches;
	}

	/** Responsibilities: _inherited parent field accumulation_. **/
	private append_inherited_parent(
		fields: Map<string, ts.Node>,
		parent_interface: ts.InterfaceDeclaration,
		seen: Set<string>,
	): void {
		for (const [name, field] of this._named_fields(parent_interface)) {
			fields.set(name, field);
		}
		for (const [name, field] of this.inherited_fields(parent_interface, seen)) {
			fields.set(name, field);
		}
	}

	/** Responsibilities: _alias-pair collaborator setup_. **/
	public constructor(named_fields: CallableNamedFieldIndex, has_matching_types: CallableMatchingAliasFields) {
		this._named_fields = named_fields;
		this._has_matching_types = has_matching_types;
	}

	/** Responsibilities: _inherited alias-pair detection_. **/
	public inherited_alias_pair(contract_candidate: ts.InterfaceDeclaration): boolean {
		const fields = this.inherited_fields(contract_candidate, new Set<string>());
		for (const name of fields.keys()) {
			let singular = name;
			if (name.endsWith("s")) {
				singular = name.slice(0, -1);
			}
			if (this._has_matching_types(fields, [singular, `${singular}s`])) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _inherited interface field lookup_. **/
	public inherited_fields(
		interface_contract: ts.InterfaceDeclaration,
		seen: Set<string>,
	): ReadonlyMap<string, ts.Node> {
		const fields = new Map<string, ts.Node>();
		if (seen.has(interface_contract.name.text)) {
			return fields;
		}
		seen.add(interface_contract.name.text);
		for (const heritage of this.heritage_types(interface_contract)) {
			if (!ts.isIdentifier(heritage.expression)) {
				continue;
			}
			for (const parent of this.named_interfaces(interface_contract.getSourceFile(), heritage.expression.text)) {
				this.append_inherited_parent(fields, parent, seen);
			}
		}
		return fields;
	}
}
