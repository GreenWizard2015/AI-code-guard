import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { MAX_CONSTRUCTOR_DEPENDENCIES } from "src/constants";
import { TypeScriptCompositionModel } from "src/linting/composition/type_script_composition_model";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { CodeClass } from "src/model_types";
import type { ClassCacheBySource } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _constructor dependency limits_, _source class index_. **/
export class TypeScriptConstructorDependencyRule implements ASTSourceRuleContract {
	private readonly _classes_by_file: ClassCacheBySource;
	private readonly _rule: DiagnosticRuleContract;

	/** Responsibilities: _source class node collection_. **/
	private class_nodes(source_file: ts.SourceFile): ts.ClassLikeDeclaration[] {
		const declarations: ts.ClassLikeDeclaration[] = [];
		for (const statement of source_file.statements) {
			if (ts.isClassDeclaration(statement)) {
				declarations.push(statement);
				continue;
			}
			if (!ts.isVariableStatement(statement)) {
				continue;
			}
			for (const declaration of statement.declarationList.declarations) {
				const initializer = declaration.initializer;
				if (initializer !== undefined && ts.isClassExpression(initializer)) {
					declarations.push(initializer);
				}
			}
		}
		return declarations;
	}

	/** Responsibilities: _class-to-position mapping_. **/
	private index_classes(
		source_file: ts.SourceFile,
		declarations: readonly ts.ClassLikeDeclaration[],
		classes: readonly CodeClass[],
	): ReadonlyMap<number, CodeClass> {
		const positions = new Map<number, CodeClass>();
		declarations.forEach((declaration, index) => {
			const code_class = classes[index];
			if (code_class !== undefined) {
				positions.set(declaration.getStart(source_file), code_class);
			}
		});
		return positions;
	}

	/** Responsibilities: _class dependency position map_. **/
	private classes_by_position(context: RuleContextContract): ReadonlyMap<number, CodeClass> {
		const {
			source: { source_file },
		} = context.state();
		const cached = this._classes_by_file.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const {
			source: { file },
			analysis: { module_resolver },
		} = context.state();
		const composition = new TypeScriptCompositionModel(file, source_file, module_resolver);
		const classes_by_position = this.index_classes(source_file, this.class_nodes(source_file), composition.classes());
		this._classes_by_file.set(source_file, classes_by_position);
		return classes_by_position;
	}

	/** Responsibilities: _class constructor dependency diagnostic_. **/
	private append_dependency_violation(declaration: ts.ClassLikeDeclaration, context: RuleContextContract): void {
		const { source_file, file } = context.state().source;
		const code_class = this.classes_by_position(context).get(declaration.getStart(source_file));
		if (code_class === undefined) {
			return;
		}
		const dependencies = new Set(code_class.dependencies);
		const count = dependencies.size;
		if (count <= MAX_CONSTRUCTOR_DEPENDENCIES) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(declaration.getStart()).line + 1;
		context.append_violation(this._rule.violation(file, line, { count: String(count) }));
	}

	/** Responsibilities: _constructor dependency rule initialization_. **/
	public constructor() {
		this._classes_by_file = new WeakMap();
		this._rule = new DiagnosticRule("constructor-dependency-count");
	}

	/** Responsibilities: _constructor dependency rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("class");
	}

	/** Responsibilities: _constructor dependency verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isClassLike(request.node)) {
			return;
		}
		this.append_dependency_violation(request.node, request.context);
	}
}
