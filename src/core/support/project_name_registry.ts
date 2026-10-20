import type { SourceNamesContract } from "src/runtime_protocols";
import type { ProjectLanguage, ProjectNameContext, ProjectNames } from "src/project_analysis_types";
import { TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _language symbol collection_, _project name aggregation_. **/
export class ProjectNameRegistry {
	private readonly input: ProjectNameContext;
	private readonly source_names: SourceNamesContract;

	/** Responsibilities: _type names normalization_. **/
	private type_names(repo_root: string): ReadonlySet<string> {
		if (!this.input.context.files().some((source) => source.absolute_path.startsWith(repo_root))) {
			return new Set<string>();
		}
		return new Set(
			this.input.context
				.files()
				.filter((source) => !source.file_name.test())
				.flatMap((source) => this.source_names.names_for_source(source, true)),
		);
	}

	/** Responsibilities: _protocol names collection_. **/
	private protocol_names(): ReadonlySet<string> {
		const names: string[] = [];
		for (const source of this.input.context.files().filter((item) => !item.file_name.test())) {
			for (const class_node of source.normalized_ast.classes) {
				if (class_node.protocol === true) {
					names.push(class_node.name);
				}
			}
		}
		return new Set(names);
	}

	/** Responsibilities: _contract names collection_. **/
	private contract_names(): ReadonlySet<string> {
		const names: string[] = [];
		for (const source of this.input.context.files().filter((item) => !item.file_name.test())) {
			if (source.typescript()) {
				names.push(
					...source.normalized_ast.classes
						.filter((class_node) => class_node.type_contract === true || class_node.protocol === true)
						.map((class_node) => class_node.name),
				);
			}
		}
		return new Set(names);
	}

	/** Responsibilities: _interface names collection_. **/
	private interface_names(): ReadonlySet<string> {
		return new Set(
			this.input.context
				.files()
				.filter((source) => !source.file_name.test() && source.typescript())
				.flatMap((source) => {
					const ast = source.normalized_ast;
					const class_names = new Set(ast.classes.map((class_node) => class_node.name));
					return [
						...ast.classes.filter((class_node) => class_node.type_contract).map((class_node) => class_node.name),
						...ast.type_declarations
							.filter((declaration) => !class_names.has(declaration.name))
							.map((declaration) => declaration.name),
					];
				}),
		);
	}

	/** Responsibilities: _project name source state_. **/
	public constructor(input: ProjectNameContext, source_names: SourceNamesContract) {
		this.input = input;
		this.source_names = source_names;
	}

	/** Responsibilities: _language-specific class names collection_. **/
	public language_classes(language: ProjectLanguage): ReadonlySet<string> {
		const names: string[] = [];
		for (const source of this.input.context.files().filter((item) => !item.file_name.test())) {
			if (source.language === language) {
				names.push(...this.source_names.names_for_source(source, false));
			}
		}
		return new Set(names);
	}

	/** Responsibilities: _class names collection_. **/
	public class_names(): ReadonlySet<string> {
		const names: string[] = [];
		for (const source of this.input.context.files().filter((item) => !item.file_name.test())) {
			names.push(...this.source_names.names_for_source(source, false));
		}
		return new Set(names);
	}

	/** Responsibilities: _project names result_. **/
	public names(repo_root: string): ProjectNames {
		return {
			project_class_names: this.class_names(),
			python_class_names: this.language_classes("python"),
			typescript_class_names: this.language_classes(TYPESCRIPT_LANGUAGE),
			project_protocol_names: this.protocol_names(),
			project_interface_names: this.interface_names(),
			project_contract_names: this.contract_names(),
			project_type_names: this.type_names(repo_root),
		};
	}
}
