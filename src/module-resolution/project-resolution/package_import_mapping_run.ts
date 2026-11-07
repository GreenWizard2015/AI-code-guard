import type { TypeScriptPathMapping } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _package import mapping collection_, _relative target expansion_. **/
export class PackageImportMappingRun {
	private readonly _collected_mappings: TypeScriptPathMapping[];
	private readonly _base_path: string;
	private readonly _conditions: ReadonlySet<string>;

	/** Responsibilities: _package imports declarations_. **/
	private append_import_members(members: ts.NodeArray<ts.ObjectLiteralElementLike>): void {
		for (const member of members) {
			if (!ts.isPropertyAssignment(member) || this.member_name(member) !== "imports") {
				continue;
			}
			if (!ts.isObjectLiteralExpression(member.initializer)) {
				continue;
			}
			for (const import_member of member.initializer.properties) {
				if (ts.isPropertyAssignment(import_member)) {
					this.append_pattern_mapping(import_member);
				}
			}
		}
	}

	/** Responsibilities: _package import pattern mapping_. **/
	private append_pattern_mapping(member: ts.PropertyAssignment): void {
		const pattern = this.member_name(member);
		if (!pattern.startsWith("#")) {
			return;
		}
		const targets = this.targets_for(member.initializer);
		if (targets.length > 0) {
			this._collected_mappings.push({ pattern, targets, base_path: this._base_path });
		}
	}

	/** Responsibilities: _relative package target expansion_. **/
	private targets_for(value: ts.Expression): string[] {
		if (ts.isStringLiteral(value)) {
			return this.string_targets(value);
		}
		if (ts.isArrayLiteralExpression(value)) {
			return this.array_targets(value);
		}
		if (ts.isObjectLiteralExpression(value)) {
			return this.object_targets(value);
		}
		return [];
	}

	/** Responsibilities: _relative string targets_. **/
	private string_targets(value: ts.StringLiteral): string[] {
		const targets: string[] = [];
		if (value.text.startsWith("./")) {
			targets.push(value.text);
		}
		return targets;
	}

	/** Responsibilities: _array target traversal_. **/
	private array_targets(value: ts.ArrayLiteralExpression): string[] {
		const targets: string[] = [];
		for (const element of value.elements) {
			targets.push(...this.targets_for(element));
		}
		return targets;
	}

	/** Responsibilities: _object target traversal_. **/
	private object_targets(value: ts.ObjectLiteralExpression): string[] {
		for (const member of value.properties) {
			if (!ts.isPropertyAssignment(member)) {
				continue;
			}
			if (!this._conditions.has(this.member_name(member))) {
				continue;
			}
			return this.targets_for(member.initializer);
		}
		return [];
	}

	/** Responsibilities: _package object member names_. **/
	private member_name(member: ts.PropertyAssignment): string {
		if (ts.isStringLiteral(member.name) || ts.isIdentifier(member.name)) {
			return member.name.text;
		}
		return "";
	}

	/** Responsibilities: _mapping collection state_. **/
	public constructor(base_path: string, conditions: ReadonlySet<string>) {
		this._collected_mappings = [];
		this._base_path = base_path;
		this._conditions = conditions;
	}

	/** Responsibilities: _package import source parsing_. **/
	public append(source: ts.JsonSourceFile): void {
		for (const statement of source.statements) {
			if (!ts.isExpressionStatement(statement) || !ts.isObjectLiteralExpression(statement.expression)) {
				continue;
			}
			this.append_import_members(statement.expression.properties);
		}
	}

	/** Responsibilities: _package mapping collection_. **/
	public mappings(): TypeScriptPathMapping[] {
		return [...this._collected_mappings];
	}
}
