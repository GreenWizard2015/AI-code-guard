import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { SharedParameterAdapter } from "src/metrics/shared_parameter/shared_parameter_adapter";
import type { SharedParameterTypeSource } from "src/metrics/types";
import type { AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type {
	ClassParameterAnalysis,
	TypeScriptSharedParameterTypeIndex,
} from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _class method parameter analysis_, _source type identity index_. **/
export class TypeScriptSharedParameterRules implements ASTSourceRuleContract {
	private readonly _type_sources: WeakMap<ts.SourceFile, TypeScriptSharedParameterTypeIndex>;

	/** Responsibilities: _source type identity lookup_. **/
	private type_sources(
		source_file: ts.SourceFile,
		normalized_ast: NormalizedAstFile,
	): TypeScriptSharedParameterTypeIndex {
		const cached = this._type_sources.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const type_sources = new Map<string, SharedParameterTypeSource>();
		for (const class_node of normalized_ast.source.classes) {
			type_sources.set(class_node.identity.name, {
				file: source_file.fileName,
				name: class_node.identity.name,
			});
		}
		for (const declaration of normalized_ast.references.type_declarations) {
			type_sources.set(declaration.name, { file: source_file.fileName, name: declaration.name });
		}
		this._type_sources.set(source_file, type_sources);
		return type_sources;
	}

	/** Responsibilities: _class parameter request construction_. **/
	private class_analysis_context(request: TypeScriptNodeVerificationRequest): ClassParameterAnalysis {
		const state = request.context.state();
		return {
			node: request.node,
			context: request.context,
			source_file: state.source.source_file,
			normalized_ast: state.source.normalized_ast,
			file: state.source.file,
			test_file: state.source.test_file,
			project_types: state.project.project_names.project_type_names,
		};
	}

	/** Responsibilities: _class declaration name lookup_. **/
	private class_declaration_name(declaration: ts.Node): string {
		if (ts.isClassLike(declaration)) {
			const name = declaration.name;
			if (name === undefined) {
				return "";
			}
			return name.text;
		}
		if (ts.isInterfaceDeclaration(declaration)) {
			return declaration.name.text;
		}
		return "";
	}

	/** Responsibilities: _class method diagnostics_. **/
	private append_method_violations(analysis: ClassParameterAnalysis, class_node: AstClassNode): void {
		if (class_node.classification.extends_external_class) {
			return;
		}
		analysis.context.state().analysis.stage_timer.measure("rule.shared-parameter.typescript-class-methods", () => {
			const adapter = new SharedParameterAdapter({
				file: analysis.file,
				kind: "method",
				nodes: class_node.structure.methods,
				type_sources: this.type_sources(analysis.source_file, analysis.normalized_ast),
				project_types: analysis.project_types,
				reference_aliases: analysis.normalized_ast.references.reference_aliases,
				language: TYPESCRIPT_CACHE_OWNER,
			});
			const violations = adapter.violations();
			for (const violation of violations) {
				analysis.context.append_violation(violation);
			}
		});
	}

	/** Responsibilities: _class summary matching_. **/
	private append_class(analysis: ClassParameterAnalysis): void {
		if (analysis.test_file) {
			return;
		}
		const declaration_line = analysis.source_file.getLineAndCharacterOfPosition(
			analysis.node.getStart(analysis.source_file),
		).line;
		const declaration_name = this.class_declaration_name(analysis.node);
		for (const class_node of analysis.normalized_ast.source.classes) {
			if (class_node.identity.start !== declaration_line) {
				continue;
			}
			if (declaration_name.length > 0 && class_node.identity.name !== declaration_name) {
				continue;
			}
			this.append_method_violations(analysis, class_node);
			return;
		}
	}

	/** Responsibilities: _shared parameter verifier initialization_. **/
	public constructor() {
		this._type_sources = new WeakMap();
	}

	/** Responsibilities: _shared parameter rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _class declaration dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (ts.isClassLike(request.node) || ts.isInterfaceDeclaration(request.node)) {
			this.append_class(this.class_analysis_context(request));
		}
	}
}
