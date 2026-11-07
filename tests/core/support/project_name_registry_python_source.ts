import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _Python type declaration metadata_, _AST node construction_. **/
export class ProjectNameRegistryPythonSource {
	/** Responsibilities: _Python class node construction_. **/
	private class_node(name: string, base_class_names: readonly string[], protocol = false): AstClassNode {
		return {
			identity: { name, start: 0, end: 1, lines: 1, sloc: 1 },
			structure: { methods: [], interfaces: [], base_class_names, dependencies: [] },
			classification: {
				extends_external_class: true,
				is_data_class: false,
				type_contract: false,
				protocol,
			},
			field_analysis: { callback_fields: 0, inline_callback_fields: 0, fields: [], untyped_fields: [] },
		};
	}

	/** Responsibilities: _Python source record construction_. **/
	public source(): LintSourceRecordData {
		const file = "/tmp/project-name-registry/status.py";
		const model = new AstModel("python");
		const normalized_ast = model.empty_ast_file();
		const enum_names = [
			{ name: "Status", bases: ["Enum"] },
			{ name: "Mode", bases: ["StrEnum"] },
			{ name: "RetryCount", bases: ["IntEnum"] },
		];
		for (const enum_name of enum_names) {
			normalized_ast.source.classes.push(this.class_node(enum_name.name, enum_name.bases));
		}
		normalized_ast.source.classes.push(this.class_node("Service", []));
		normalized_ast.source.classes.push(this.class_node("ReaderContract", ["Protocol"], true));
		const typescript_ast = new TypeScriptAstFile(file, "");
		const traversal = new TypeScriptAstTraversal(typescript_ast.source_file_node());
		return {
			absolute_path: file,
			relative_path: "status.py",
			file_name: new LintFileName("status.py"),
			text: "",
			normalized_ast,
			language: "python",
			typescript_ast,
			source_resolver: new Map(),
			traversal,
		};
	}
}
