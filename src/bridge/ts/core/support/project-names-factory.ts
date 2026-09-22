import { SourceNames } from 'src/bridge/ts/core/support/source-names';
import type { LintProjectContext } from 'src/protocols';
import type { ProjectNames } from 'src/bridge/ts/core/types';

/** Responsibilities: _derivation project class protocol_. **/
export class ProjectNameRegistry {
	private readonly source_names = new SourceNames();

	/** Responsibilities: _collection type names normalization_. **/
	private type_names(
		repo_root: string,
		project_files: string[],
		context: LintProjectContext
	): ReadonlySet<string> {
		if (!project_files.some(file => file.startsWith(repo_root))) {
			return new Set<string>();
		}
		return new Set(project_files
			.filter(file => !context.source_record(file).file_name.test())
			.flatMap(file => this.source_names.names_for_source(context.source_record(file), true)));
	}

	/** Responsibilities: _collection protocol names project_. **/
	private protocol_names(project_files: string[], context: LintProjectContext): ReadonlySet<string> {
		const names: string[] = [];
		for (const file of project_files) {
			const source = context.source_record(file);
			for (const class_node of source.normalized_ast.classes) {
				if (class_node.protocol === true) {
					names.push(class_node.name);
				}
			}
		}
		return new Set(names);
	}

	/** Responsibilities: _collection contract names project_. **/
	private contract_names(project_files: string[], context: LintProjectContext): ReadonlySet<string> {
		const names: string[] = [];
		for (const file of project_files) {
			const source = context.source_record(file);
			if (source.typescript()) {
				names.push(...source.normalized_ast.classes.map(class_node => class_node.name));
			}
		}
		return new Set(names);
	}

	/** Responsibilities: _collection class names project_. **/
	public class_names(project_files: string[], context: LintProjectContext): ReadonlySet<string> {
		const names: string[] = [];
		for (const file of project_files) {
			names.push(...this.source_names.names_for_source(context.source_record(file), false));
		}
		return new Set(names);
	}

	/** Responsibilities: _output project names needed_. **/
	public names(
		repo_root: string,
		project_files: string[],
		context: LintProjectContext
	): ProjectNames {
		return {
			project_class_names: this.class_names(project_files, context),
			project_protocol_names: this.protocol_names(project_files, context),
			project_contract_names: this.contract_names(project_files, context),
			project_type_names: this.type_names(repo_root, project_files, context),
		};
	}
}
