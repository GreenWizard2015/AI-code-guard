import { isAbsolute, relative, sep } from "node:path";
import { TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_LANGUAGE } from "src/constants";
import { SourceNameCollection } from "src/core/support/source_name_collection";
import type {
	ProjectLanguage,
	ProjectLanguageNames,
	ProjectNameContext,
	ProjectNames,
} from "src/project_analysis_types";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _language symbol collection_, _project name aggregation_. **/
export class ProjectNameRegistry {
	private readonly _sources: readonly LintSourceRecordData[];
	private readonly _production_sources: readonly LintSourceRecordData[];
	private readonly _repo_root: string;

	/** Responsibilities: _type names_. **/
	private type_names(): ReadonlySet<string> {
		if (!this._sources.some((source) => this.within_root(source.absolute_path))) {
			return new Set<string>();
		}
		const names = new Set<string>();
		for (const source of this._production_sources) {
			for (const name of this.names_for_source(source, true)) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _project root containment_. **/
	private within_root(source_path: string): boolean {
		const relative_path = relative(this._repo_root, source_path);
		if (relative_path.length === 0 || relative_path === "..") {
			return relative_path.length === 0;
		}
		if (relative_path.startsWith(`..${sep}`) || isAbsolute(relative_path)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _project type alias names_. **/
	private type_alias_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const source of this._production_sources) {
			const source_names = new SourceNameCollection(source);
			for (const name of source_names.type_alias_names()) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _language source name collection_. **/
	private add_source_names(names: ProjectLanguageNames, source: LintSourceRecordData): void {
		const source_names = new SourceNameCollection(source);
		for (const name of source_names.names(false)) {
			names.class_names.add(name);
		}
		for (const name of source_names.names(true)) {
			names.type_names.add(name);
		}
		for (const name of source_names.type_alias_names()) {
			names.type_alias_names.add(name);
		}
	}

	/** Responsibilities: _language-specific project names_. **/
	private language_names(language: ProjectLanguage): ProjectLanguageNames {
		const names = {
			class_names: new Set<string>(),
			type_names: new Set<string>(),
			type_alias_names: new Set<string>(),
		};
		for (const source of this._production_sources) {
			if (source.language === language) {
				this.add_source_names(names, source);
			}
		}
		return names;
	}

	/** Responsibilities: _protocol names collection_. **/
	private protocol_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const source of this._production_sources) {
			const source_names = new SourceNameCollection(source);
			for (const name of source_names.protocol_names()) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _contract names collection_. **/
	private contract_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const source of this._production_sources) {
			const source_names = new SourceNameCollection(source);
			for (const name of source_names.contract_names()) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _interface names collection_. **/
	private interface_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const source of this._production_sources) {
			if (source.language !== TYPESCRIPT_CACHE_OWNER) {
				continue;
			}
			const source_names = new SourceNameCollection(source);
			for (const name of source_names.interface_names()) {
				names.add(name);
			}
		}
		return names;
	}

	/** Responsibilities: _project name source state_. **/
	public constructor(input: ProjectNameContext) {
		const sources = input.context.files();
		this._sources = sources;
		this._production_sources = sources.filter((source) => !source.file_name.test());
		this._repo_root = input.repo_root;
	}

	/** Responsibilities: _source declaration names_. **/
	public names_for_source(source: LintSourceRecordData, include_type_declarations: boolean): string[] {
		const source_names = new SourceNameCollection(source);
		return source_names.names(include_type_declarations);
	}

	/** Responsibilities: _class names collection_. **/
	public class_names(): ReadonlySet<string> {
		const names: string[] = [];
		for (const source of this._production_sources) {
			names.push(...this.names_for_source(source, false));
		}
		return new Set(names);
	}

	/** Responsibilities: _project names result_. **/
	public names(): ProjectNames {
		const python_names = this.language_names("python");
		const typescript_names = this.language_names(TYPESCRIPT_LANGUAGE);
		return {
			project_class_names: this.class_names(),
			python_class_names: python_names.class_names,
			typescript_class_names: typescript_names.class_names,
			project_protocol_names: this.protocol_names(),
			project_interface_names: this.interface_names(),
			project_contract_names: this.contract_names(),
			project_type_names: this.type_names(),
			project_alias_names: this.type_alias_names(),
			typescript_type_names: typescript_names.type_names,
			typescript_alias_names: typescript_names.type_alias_names,
		};
	}
}
