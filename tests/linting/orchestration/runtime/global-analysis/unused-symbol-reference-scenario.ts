import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import type { UnusedSymbolDefinition } from "src/core/types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintSourceRecordData } from "src/source_types";
import { ImportedSourceScanner } from "tests/bridge/ts/core/unused_symbol_import_scanner_fixture";

/** Responsibilities: _imported definition usage evidence_, _source import setup_. **/
export class UnusedSymbolReferenceScenario {
	/** Responsibilities: _consumer source record_. **/
	public consumer_source(): LintSourceRecordData {
		const ast_model = new AstModel("python");
		const empty_ast = ast_model.empty_ast_file();
		const ast = {
			...empty_ast,
			references: {
				...empty_ast.references,
				reference_aliases: [{ name: "local_target", target: "Target" }],
				symbol_references: [
					{ name: "local_target", line: 0 },
					{ name: "local_target", line: 1 },
				],
			},
		};
		const typescript_ast = new TypeScriptAstFile("/project/consumer.py", "");
		const traversal = new TypeScriptAstTraversal(typescript_ast.source_file_node());
		return {
			absolute_path: "/project/consumer.py",
			relative_path: "consumer.py",
			file_name: new LintFileName("consumer.py"),
			text: "local_target\nlocal_target\n",
			normalized_ast: ast,
			language: "python",
			typescript_ast,
			source_resolver: new Map(),
			traversal,
		};
	}

	/** Responsibilities: _imported definition records_. **/
	public imported_definitions(): UnusedSymbolDefinition[] {
		return ["first.py", "second.py", "third.py"].map((file) => ({
			file,
			line: 1,
			name: "Target",
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		}));
	}

	/** Responsibilities: _imported source scanner_. **/
	public imported_source_scanner(): ImportedSourceScanner {
		return new ImportedSourceScanner(["first.py", "second.py", "third.py"]);
	}
}
