import { createHash } from "node:crypto";
import type ts from "typescript";

import type { DuplicateTypeShapesContract } from "src/analysis_protocols";
import type { AstClassNode, DuplicateTypeShape, NamedLine, NamedShape } from "src/model/ast/normalized_ast_types";
import { TypeScriptTypeShapeCollector } from "src/rules/typescript/syntax-rules/types/type_script_type_shape_collector";

/** Responsibilities: _type shape normalization_, _cross-language duplicate grouping_. **/
export class DuplicateTypeShapes implements DuplicateTypeShapesContract {
	private readonly hash_algorithm = "sha256";
	private readonly _typescript_cache: WeakMap<ts.SourceFile, readonly DuplicateTypeShape[]>;
	private readonly _python_cache: WeakMap<readonly AstClassNode[], readonly DuplicateTypeShape[]>;

	/** Responsibilities: _creation stable hash fields_. **/
	private shape_hash(fields: readonly string[], base_names: readonly string[]): string {
		const sorted_fields = [...fields];
		sorted_fields.sort((left, right) => left.localeCompare(right));
		const sorted_base_names = [...base_names];
		sorted_base_names.sort((left, right) => left.localeCompare(right));
		const serialized_base_names = sorted_base_names.map((base) => `base:${base}`);
		const serialized_parts = [...serialized_base_names, ...sorted_fields];
		const serialized = serialized_parts.join("\n");
		return createHash(this.hash_algorithm).update(serialized).digest("hex");
	}

	/** Responsibilities: _named shape its addition_. **/
	private add_shape(groups: Map<string, NamedLine[]>, shape: NamedShape): void {
		if (shape.fields.length === 0) {
			return;
		}
		const hash = this.shape_hash(shape.fields, shape.base_names);
		let matches = groups.get(hash);
		if (matches === undefined) {
			matches = [];
			groups.set(hash, matches);
		}
		matches.push({ name: shape.name, line: shape.line });
	}

	/** Responsibilities: _identification groups containing duplicate_. **/
	private duplicate_groups(shapes: readonly NamedShape[]): DuplicateTypeShape[] {
		const groups = new Map<string, NamedLine[]>();
		for (const shape of shapes) {
			this.add_shape(groups, shape);
		}
		const duplicates: DuplicateTypeShape[] = [];
		for (const matches of groups.values()) {
			if (matches.length < 2) {
				continue;
			}
			for (const first of matches) {
				duplicates.push({ line: first.line, names: matches.map((match) => match.name) });
				break;
			}
		}
		return duplicates;
	}

	/** Responsibilities: _normalization Python classes conversion_. **/
	private python_shapes(classes: readonly AstClassNode[]): NamedShape[] {
		return classes.map((class_node) => ({
			name: class_node.identity.name,
			line: class_node.identity.start + 1,
			fields: class_node.field_analysis.fields.map((field) => `${field.name}:${field.type}`),
			base_names: class_node.structure.base_class_names,
		}));
	}

	/** Responsibilities: _shape analysis cache initialization_. **/
	public constructor() {
		this._typescript_cache = new WeakMap<ts.SourceFile, readonly DuplicateTypeShape[]>();
		this._python_cache = new WeakMap<readonly AstClassNode[], readonly DuplicateTypeShape[]>();
	}

	/** Responsibilities: _reporting duplicate TypeScript type_. **/
	public typescript(source_file: ts.SourceFile): readonly DuplicateTypeShape[] {
		const cached = this._typescript_cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const collector = new TypeScriptTypeShapeCollector(source_file);
		const shapes = collector.collect();
		const groups = this.duplicate_groups(shapes);
		const duplicates = Object.freeze(
			groups.map((shape) => Object.freeze({ line: shape.line, names: Object.freeze([...shape.names]) })),
		);
		this._typescript_cache.set(source_file, duplicates);
		return duplicates;
	}

	/** Responsibilities: _reporting duplicate Python class_. **/
	public python(classes: readonly AstClassNode[]): readonly DuplicateTypeShape[] {
		const cached = this._python_cache.get(classes);
		if (cached !== undefined) {
			return cached;
		}
		const groups = this.duplicate_groups(this.python_shapes(classes));
		const duplicates = Object.freeze(
			groups.map((shape) => Object.freeze({ line: shape.line, names: Object.freeze([...shape.names]) })),
		);
		this._python_cache.set(classes, duplicates);
		return duplicates;
	}
}
