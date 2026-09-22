import { MixCollection } from 'src/bridge/ts/core/mix-collection';
import { AstModel } from 'src/bridge/ts/core/ast-model';
import { Syntax } from 'src/syntax';
import type { LintFileNameContract, NormalizedAstFile } from 'src/types';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import type { TypeScriptScannerOptions } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { Violation } from 'src/protocols';
import { TypeScriptScannerRules } from 'src/bridge/ts/runner/orchestration/runtime/typescript-scanner-rules';

/** Responsibilities: _TypeScript AST state preparation_, _TypeScript rule groups execution_. **/
export class TypeScriptScannerClass {
	private readonly file_name: LintFileNameContract;
	private readonly lines: string[];
	private readonly ast_file: TypeScriptAstFile;
	private readonly ast: NormalizedAstFile;
	private readonly rules: TypeScriptScannerRules;

	public readonly violations: Violation[] = [];

	/** Responsibilities: _mixed-module violations addition_. **/
	private append_mixed_rules(): void {
		const mix_collection = new MixCollection();
		mix_collection.append_mix_violations(
			this.violations,
			this.ast.classes,
			this.ast.functions,
			this.file_name
		);
	}

	/** Responsibilities: _scanner state initialization_, _rule collaborators preparation_. **/
	public constructor(options: TypeScriptScannerOptions) {
		const syntax = new Syntax();
		const ast_model = new AstModel();

		this.file_name = options.file_name;
		this.lines = syntax.split_lines(options.text);
		this.ast_file = options.ast_file;
		const parsed_ast = this.ast_file.normalized();
		ast_model.mark_external_bases(parsed_ast.classes, options.project_class_names);
		this.ast = parsed_ast;
		this.rules = new TypeScriptScannerRules({
			file_name: this.file_name,
			project_class_names: options.project_class_names,
			project_type_names: options.project_type_names,
			project_contract_names: options.project_contract_names,
			lines: this.lines,
			ast_file: this.ast_file,
			ast: this.ast,
		});
	}

	/** Responsibilities: _TypeScript rule groups execution_. **/
	public scan(): void {
		this.violations.length = 0;
		this.rules.append(this.violations);
	}

	/** Responsibilities: _mixed-module analysis execution_. **/
	public scan_mixed_module(): void {
		this.violations.length = 0;
		this.append_mixed_rules();
	}

}
