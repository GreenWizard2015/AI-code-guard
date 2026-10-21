import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { UnusedSymbolPropertyOwnershipContract } from "src/linting/orchestration/runtime/global-analysis/protocols";
import type { UnusedSymbolDefinition } from "src/core/types";
import type { LintSourceRecord } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _unused property usage_, _field contract references_. **/
export class UnusedSymbolPropertyUsageIndex {
	private readonly references: SourceReferenceIndexContract<string>;
	private readonly ownership: UnusedSymbolPropertyOwnershipContract;

	/** Responsibilities: _field usage reference insertion_. **/
	private add_field_usage(
		source: LintSourceRecord,
		source_file: ts.SourceFile,
		receiver: ts.Expression,
		name: string,
		position: number,
	): void {
		const owners = this.ownership.property_usage_owners(source, source_file, receiver, name);
		const line = source_file.getLineAndCharacterOfPosition(position).line + 1;
		for (const owner of owners) {
			const key = `field\u0000${owner.file}\u0000${owner.owner}\u0000${name}`;
			this.references.add_usage(key, { file: source.relative_path, line });
		}
	}

	/** Responsibilities: _property access references_. **/
	private property_usage(source: LintSourceRecord, source_file: ts.SourceFile, node: ts.Node): void {
		if (ts.isPropertyAccessExpression(node)) {
			this.add_field_usage(source, source_file, node.expression, node.name.text, node.name.getStart(source_file));
			return;
		}
		if (!ts.isElementAccessExpression(node)) {
			return;
		}
		const argument = node.argumentExpression;
		if (argument === undefined) {
			return;
		}
		if (ts.isStringLiteral(argument)) {
			this.add_field_usage(source, source_file, node.expression, argument.text, argument.getStart(source_file));
		}
	}

	/** Responsibilities: _object property references_. **/
	private object_property_usage(source: LintSourceRecord, source_file: ts.SourceFile, node: ts.Node): void {
		if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node)) {
			return;
		}
		if (!ts.isIdentifier(node.name) && !ts.isStringLiteral(node.name)) {
			return;
		}
		this.add_field_usage(source, source_file, node.parent, node.name.text, node.name.getStart(source_file));
	}

	/** Responsibilities: _property usage dependencies_. **/
	public constructor(
		references: SourceReferenceIndexContract<string>,
		ownership: UnusedSymbolPropertyOwnershipContract,
	) {
		this.references = references;
		this.ownership = ownership;
	}

	/** Responsibilities: _TypeScript property traversal_. **/
	public add_source(source: LintSourceRecord): void {
		if (!source.typescript()) {
			return;
		}
		const source_file = source.typescript_ast.source_file_node();
		const visit = (node: ts.Node): void => {
			this.property_usage(source, source_file, node);
			this.object_property_usage(source, source_file, node);
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _field contract usage_. **/
	public usage_present(definition: UnusedSymbolDefinition): boolean {
		const field_key = `field\u0000${definition.file}\u0000${definition.owner}\u0000${definition.name}`;
		if (this.references.references_for(field_key, "usage").length > 0) {
			return true;
		}
		for (const owner of this.ownership.contract_fields(definition)) {
			const key = `field\u0000${owner.file}\u0000${owner.owner}\u0000${definition.name}`;
			if (this.references.references_for(key, "usage").length > 0) {
				return true;
			}
		}
		return false;
	}
}
