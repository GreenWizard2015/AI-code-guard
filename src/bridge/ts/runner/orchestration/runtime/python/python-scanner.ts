import { AstModel } from 'src/bridge/ts/core/ast-model';
import { Syntax } from 'src/syntax';
import type { Violation } from 'src/protocols';
import type { PythonRuleInput } from 'src/runner/types';
import type { AstClassNode, NormalizedAstFile } from 'src/types';
import { PythonAstFileRuleCollector } from 'src/bridge/ts/runner/orchestration/runtime/python/python-ast-file-rule-collector';
import { PythonRuleCollector } from 'src/bridge/ts/runner/orchestration/runtime/python/python-rule-collector';




import type {
	PythonLintInput,
	PythonProjectNames,
} from 'src/bridge/ts/runner/orchestration/runtime/python/types';

/** Responsibilities: _construction Python rules register_. **/
export class PythonScanner {
	private readonly ast_model = new AstModel();

	/** Responsibilities: _creation Python rule collectors_. **/
	private create_python_rules(
		project_class_names: ReadonlySet<string>,
		project_protocol_names: ReadonlySet<string>,
		normalized_ast: NormalizedAstFile
	): NormalizedAstFile {
		const ast = normalized_ast;
		this.ast_model.mark_external_bases(ast.classes, project_class_names);
		this.mark_protocol_implementations(ast.classes, project_protocol_names);
		return ast;
	}

	/** Responsibilities: _marking protocol implementations Python_. **/
	private mark_protocol_implementations(
		classes: AstClassNode[],
		protocol_names: ReadonlySet<string>
	): void {
		for (const class_node of classes) {
			let base_names: readonly string[] = [];
			if (class_node.base_class_names !== undefined) {
				base_names = class_node.base_class_names;
			}
			const interfaces = base_names.filter(base_name => protocol_names.has(base_name));
			if (interfaces.length > 0) {
				class_node.interfaces = interfaces;
			}
		}
	}

	/** Responsibilities: _aggregation Python rules normalization_. **/
	private append_python_rules(input: PythonRuleInput): void {
		const collector = new PythonRuleCollector(input);
		collector.append_metrics();
		collector.append_architecture();
	}

	/** Responsibilities: _collection Python class protocol_. **/
	public project_names(input: PythonLintInput): PythonProjectNames {
		return {
			project_class_names: input.project_class_names,
			project_protocol_names: input.project_protocol_names,
			project_type_names: input.project_type_names,
		};
	}

	/** Responsibilities: _lint Python file output_. **/
	public lint_python_file(input: PythonLintInput): Violation[] {
		const syntax = new Syntax();
		const names = this.project_names(input);
		const normalized_ast = input.normalized_ast;
		const ast = this.create_python_rules(
			names.project_class_names,
			names.project_protocol_names,
			normalized_ast
		);
		const collector = new PythonAstFileRuleCollector(
			ast,
			input.file_name,
			syntax.split_lines(input.text),
			names,
			input => this.append_python_rules(input)
		);
		return collector.collect_violations();
	}
}
