import { resolve as resolve_path } from "node:path";
import { TYPESCRIPT_CONFIG_FILE } from "src/constants";
import { CompilerResolutionSettings } from "src/module-resolution/project-resolution/compiler_resolution_settings";
import type { TypeScriptResolutionBases } from "src/module-resolution/protocols";
import type { TypeScriptModuleResolutionOptions } from "src/module-resolution/types";
import type { ProjectSourceContentIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _compiler config sources_, _resolution base paths_. **/
export class ProjectResolutionConfiguration {
	private readonly _project_root: string;
	private readonly _config_file: string;
	private readonly _source_io: ProjectSourceContentIOContract;
	private readonly _config_host: ts.ParseConfigHost;
	private readonly _configuration_sources: Set<string>;

	/** Responsibilities: _parsed compiler options_. **/
	private parsed_config(): ts.ParsedCommandLine {
		const loaded_config = ts.readConfigFile(this._config_file, (file) => {
			if (!this._source_io.source_available(file)) {
				return undefined;
			}
			return this._source_io.source_text(file);
		});
		if (loaded_config.error !== undefined) {
			return ts.parseJsonConfigFileContent({}, this._config_host, this._project_root);
		}
		return ts.parseJsonConfigFileContent(
			loaded_config.config,
			this._config_host,
			this._project_root,
			undefined,
			this._config_file,
		);
	}

	/** Responsibilities: _compiler path bases_. **/
	private resolution_bases(parsed: ts.ParsedCommandLine): TypeScriptResolutionBases {
		let base_url = this._project_root;
		let paths_base = this._project_root;
		if (parsed.options.baseUrl !== undefined) {
			base_url = resolve_path(this._project_root, parsed.options.baseUrl);
			paths_base = base_url;
			return { base_url, paths_base };
		}
		for (const [option_name, option_value] of Object.entries(parsed.options)) {
			if (option_name === "pathsBasePath" && typeof option_value === "string") {
				paths_base = resolve_path(this._project_root, option_value);
				base_url = paths_base;
			}
		}
		return { base_url, paths_base };
	}

	/** Responsibilities: _configuration source ownership_. **/
	public constructor(project_root: string, source_io: ProjectSourceContentIOContract) {
		this._project_root = project_root;
		this._config_file = resolve_path(project_root, TYPESCRIPT_CONFIG_FILE);
		this._source_io = source_io;
		this._configuration_sources = new Set<string>();
		this._config_host = {
			useCaseSensitiveFileNames: true,
			readDirectory: (): string[] => [],
			fileExists: (file: string): boolean => {
				if (!this._source_io.source_available(file)) {
					return false;
				}
				this._configuration_sources.add(resolve_path(file));
				return true;
			},
			readFile: (file: string) => {
				if (!this._source_io.source_available(file)) {
					return undefined;
				}
				this._configuration_sources.add(resolve_path(file));
				return this._source_io.source_text(file);
			},
		};
	}

	/** Responsibilities: _transitive configuration files_. **/
	public configuration_files(): readonly string[] {
		this._configuration_sources.add(this._config_file);
		this.parsed_config();
		return [...this._configuration_sources];
	}

	/** Responsibilities: _compiler module options_. **/
	public module_options(resolution_mode: string): TypeScriptModuleResolutionOptions {
		const parsed = this.parsed_config();
		const bases = this.resolution_bases(parsed);
		const settings = new CompilerResolutionSettings(parsed.options, bases.paths_base);
		return {
			base_url: bases.base_url,
			paths_base: bases.paths_base,
			package_conditions: settings.package_conditions(resolution_mode),
			paths: settings.path_mappings(),
		};
	}
}
