import ts from "typescript";

import type { AstCallableNode, AstClassNodeIdentity } from "src/model/ast/normalized_ast_types";
import type {
	SourceLineRange,
	TypeScriptClassAstSections,
	TypeScriptClassDeclarationMetadataOptions,
	TypeScriptClassHeritage,
	TypeScriptClassMemberMetrics,
	TypeScriptClassNodeFeatures,
} from "src/model/types";
import type { TypeScriptClassMembersContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _class declaration identity_, _class structure and analysis_. **/
export class TypeScriptClassDeclarationMetadata {
	private readonly _class_declaration: ts.ClassLikeDeclaration;
	private readonly _fallback_name: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _member_data: TypeScriptClassMembersContract;
	private readonly _methods: AstCallableNode[];

	/** Responsibilities: _class source line range_. **/
	private class_lines(): SourceLineRange {
		const start_position = this._class_declaration.getStart(this._source_file);
		const end_position = Math.max(start_position, this._class_declaration.end - 1);
		const start = this._source_file.getLineAndCharacterOfPosition(start_position).line;
		const end = this._source_file.getLineAndCharacterOfPosition(end_position).line;
		return { start, end };
	}

	/** Responsibilities: _class member size_. **/
	private member_metrics_for(
		member: ts.ClassElement,
		method_sloc: ReadonlyMap<number, number>,
	): TypeScriptClassMemberMetrics {
		const start_line = this._source_file.getLineAndCharacterOfPosition(member.getStart(this._source_file)).line;
		const end_line = this._source_file.getLineAndCharacterOfPosition(member.end - 1).line;
		const method_lines = method_sloc.get(start_line);
		let sloc = 1;
		if (method_lines !== undefined) {
			sloc = method_lines;
		}
		const line_difference = end_line - start_line;
		return { lines: line_difference + 1, sloc };
	}

	/** Responsibilities: _class member metrics_. **/
	private member_metrics(): TypeScriptClassMemberMetrics {
		const method_sloc = new Map<number, number>();
		for (const method of this._methods) {
			method_sloc.set(method.identity.start, method.metrics.sloc);
		}
		let sloc = 1;
		let lines = 0;
		for (const member of this._class_declaration.members) {
			const metrics = this.member_metrics_for(member, method_sloc);
			lines += metrics.lines;
			sloc += metrics.sloc;
		}
		return { lines, sloc };
	}

	/** Responsibilities: _class inheritance metadata_. **/
	private class_heritage(): TypeScriptClassHeritage {
		const interfaces: string[] = [];
		const base_class_names: string[] = [];
		const heritage_clauses = this._class_declaration.heritageClauses;
		if (heritage_clauses !== undefined) {
			for (const clause of heritage_clauses) {
				const names = clause.types.map((type) => type.expression.getText(this._source_file));
				if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
					interfaces.push(...names);
				}
				if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
					base_class_names.push(...names);
					break;
				}
			}
		}
		return { interfaces, base_class_names };
	}

	/** Responsibilities: _class structure_, _class analysis_. **/
	private class_features(): TypeScriptClassNodeFeatures {
		const heritage = this.class_heritage();
		const callbacks = this._member_data.callback_counts(this._class_declaration);
		return {
			structure: {
				interfaces: heritage.interfaces,
				base_class_names: heritage.base_class_names,
				methods: this._methods,
				fields: this._member_data.class_fields(this._class_declaration),
				dependencies: [],
			},
			analysis: {
				extends_external_class: false,
				is_data_class: false,
				type_contract: false,
				protocol: false,
				callback_fields: callbacks.total,
				inline_callback_fields: callbacks.inline,
				untyped_fields: [],
			},
		};
	}

	/** Responsibilities: _class metadata inputs_. **/
	public constructor(options: TypeScriptClassDeclarationMetadataOptions) {
		this._class_declaration = options.class_declaration;
		this._fallback_name = options.fallback_name;
		this._source_file = options.source_file;
		this._member_data = options.member_data;
		this._methods = options.callable_nodes.class_method_nodes(this._class_declaration, this._fallback_name);
	}

	/** Responsibilities: _class AST sections_. **/
	public sections(): TypeScriptClassAstSections {
		const features = this.class_features();
		return {
			structure: {
				methods: features.structure.methods,
				interfaces: features.structure.interfaces,
				base_class_names: features.structure.base_class_names,
				dependencies: features.structure.dependencies,
			},
			classification: {
				extends_external_class: features.analysis.extends_external_class,
				is_data_class: features.analysis.is_data_class,
				type_contract: features.analysis.type_contract,
				protocol: features.analysis.protocol,
			},
			field_analysis: {
				callback_fields: features.analysis.callback_fields,
				inline_callback_fields: features.analysis.inline_callback_fields,
				fields: features.structure.fields,
				untyped_fields: features.analysis.untyped_fields,
			},
		};
	}

	/** Responsibilities: _class identity metadata_. **/
	public identity(): AstClassNodeIdentity {
		const range = this.class_lines();
		const metrics = this.member_metrics();
		let name = this._fallback_name;
		if (this._class_declaration.name !== undefined) {
			name = this._class_declaration.name.text;
		}
		return { name, start: range.start, end: range.end, lines: metrics.lines, sloc: metrics.sloc };
	}
}
