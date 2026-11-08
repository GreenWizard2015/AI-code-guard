import { AnyTypes } from "src/any_types";
import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { LintFileName } from "src/core/context/lint_file_name";
import { CallableNamingRules } from "src/metrics/callable_naming_rules";
import type { AstCallableNode, AstClassNode } from "src/model/ast/normalized_ast_types";
import { TypeScriptTypeAliases } from "src/parser/typescript-aliases/expressions/type_script_type_aliases";
import type { ViolationContract } from "src/reporting_protocols";
import type { AnyTypesContract, CallableNamingRulesContract } from "src/shared_services_protocols";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type { TypeScriptTypeAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable naming rules_, _generic type rules_. **/
export class TypeScriptCallableRules implements ASTSourceRuleContract {
	private readonly _aliases: WeakMap<ts.SourceFile, TypeScriptTypeAliasesContract>;
	private readonly _any_types: WeakMap<ts.SourceFile, AnyTypesContract>;
	private readonly _naming: WeakMap<ts.SourceFile, CallableNamingRulesContract>;

	/** Responsibilities: _source class summary resolution_. **/
	private append_class_summary(class_request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = class_request;
		const {
			source: { source_file, normalized_ast },
		} = context.state();
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		let name = "";
		if (ts.isClassLike(node)) {
			const declaration_name = node.name;
			if (declaration_name !== undefined) {
				name = declaration_name.text;
			}
		} else if (ts.isInterfaceDeclaration(node)) {
			name = node.name.text;
		}
		this.append_class_candidate(line, name, normalized_ast.source.classes, context);
	}

	/** Responsibilities: _matching class diagnostic dispatch_. **/
	private append_class_candidate(
		class_start_line: number,
		class_name: string,
		class_summaries: readonly AstClassNode[],
		class_context: RuleContextContract,
	): void {
		for (const candidate of class_summaries) {
			if (candidate.identity.start !== class_start_line) {
				continue;
			}
			if (class_name.length > 0 && candidate.identity.name !== class_name) {
				continue;
			}
			this.append_class(class_context, candidate);
			return;
		}
	}

	/** Responsibilities: _source callable summary resolution_. **/
	private append_function_summary(function_request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = function_request;
		const {
			source: { source_file, normalized_ast },
		} = context.state();
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		let name = "";
		if (ts.isFunctionDeclaration(node)) {
			const declaration_name = node.name;
			if (declaration_name !== undefined) {
				name = declaration_name.text;
			}
		}
		if (ts.isVariableDeclaration(node)) {
			name = node.name.getText(source_file);
		}
		this.append_function_candidate(line, name, normalized_ast.source.functions, context);
	}

	/** Responsibilities: _matching callable diagnostic dispatch_. **/
	private append_function_candidate(
		callable_start_line: number,
		callable_name: string,
		callable_summaries: readonly AstCallableNode[],
		callable_context: RuleContextContract,
	): void {
		const callable = callable_summaries.find(
			(item) => item.identity.start === callable_start_line && item.identity.name === callable_name,
		);
		if (callable === undefined) {
			return;
		}
		this.append_callable(callable_context, callable);
	}

	/** Responsibilities: _source type alias resolution_. **/
	private type_aliases(alias_source: ts.SourceFile): TypeScriptTypeAliasesContract {
		const cached = this._aliases.get(alias_source);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new TypeScriptTypeAliases();
		aliases.collect(alias_source);
		this._aliases.set(alias_source, aliases);
		return aliases;
	}

	/** Responsibilities: _source any-type rule resolution_. **/
	private any_types(diagnostics_source: ts.SourceFile): AnyTypesContract {
		const cached = this._any_types.get(diagnostics_source);
		if (cached !== undefined) {
			return cached;
		}
		const rules = new AnyTypes(this.type_aliases(diagnostics_source));
		this._any_types.set(diagnostics_source, rules);
		return rules;
	}

	/** Responsibilities: _source callable naming resolution_. **/
	private callable_naming(naming_source: ts.SourceFile, file: string): CallableNamingRulesContract {
		const cached = this._naming.get(naming_source);
		if (cached !== undefined) {
			return cached;
		}
		const naming = new CallableNamingRules(new LintFileName(file));
		this._naming.set(naming_source, naming);
		return naming;
	}

	/** Responsibilities: _callable diagnostic collection_. **/
	private append_callable(callable_context: RuleContextContract, callable: AstCallableNode): void {
		const {
			source: { file, source_file },
		} = callable_context.state();
		const violations: ViolationContract[] = [];
		const naming = this.callable_naming(source_file, file);
		naming.append(violations, [callable]);
		naming.append_flag_parameters(violations, [callable]);
		this.any_types(source_file).append_any_info({
			violations,
			file,
			functions: [callable],
			methods: [],
			classes: [],
		});
		for (const violation of violations) {
			callable_context.append_violation(violation);
		}
	}

	/** Responsibilities: _class member diagnostics_. **/
	private append_class(class_context: RuleContextContract, declaration: AstClassNode): void {
		const {
			source: { file, source_file },
		} = class_context.state();
		const violations: ViolationContract[] = [];
		const naming = this.callable_naming(source_file, file);
		for (const method of declaration.structure.methods) {
			naming.append(violations, [method]);
			naming.append_flag_parameters(violations, [method]);
		}
		this.any_types(source_file).append_any_info({
			violations,
			file,
			functions: [],
			methods: declaration.structure.methods,
			classes: [declaration],
		});
		for (const violation of violations) {
			class_context.append_violation(violation);
		}
	}

	/** Responsibilities: _callable verifier initialization_. **/
	public constructor() {
		this._aliases = new WeakMap();
		this._any_types = new WeakMap();
		this._naming = new WeakMap();
	}

	/** Responsibilities: _callable diagnostic activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _callable AST node dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node } = request;
		if (ts.isClassLike(node) || ts.isInterfaceDeclaration(node)) {
			this.append_class_summary(request);
			return;
		}
		if (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) {
			this.append_function_summary(request);
		}
	}
}
