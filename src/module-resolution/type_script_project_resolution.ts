import { resolve as resolve_path } from "node:path";
import ts from "typescript";
import { TYPESCRIPT_CONFIG_FILE } from "src/constants";
import { TypeScriptModuleResolutionConfig } from "src/module-resolution/type_script_module_resolution_config";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type {
	TypeScriptModuleResolutionContract,
	TypeScriptModuleResolutionOptions,
	TypeScriptPathMapping,
} from "src/module-resolution/types";

/** Responsibilities: _compiler path configuration_, _configuration cache identity_. **/
export class TypeScriptProjectResolution {
	private readonly project_root: string;
	private readonly source_io: ProjectSourceIOContract;
	private readonly config_host: ts.ParseConfigHost;

	/** Responsibilities: _compiler path mapping collection_. **/
	private path_mappings(options: ts.CompilerOptions): TypeScriptPathMapping[] {
		const paths: TypeScriptPathMapping[] = [];
		if (options.paths === undefined) {
			return paths;
		}
		for (const [pattern, targets] of Object.entries(options.paths)) {
			paths.push({ pattern, targets });
		}
		return paths;
	}

	/** Responsibilities: _parsed compiler configuration_. **/
	private parsed_config(config_file: string): ts.ParsedCommandLine {
		const loaded_config = ts.readConfigFile(config_file, (file) => {
			if (!this.source_io.source_available(file)) {
				return undefined;
			}
			return this.source_io.source_text(file);
		});
		if (loaded_config.error !== undefined) {
			return ts.parseJsonConfigFileContent({}, this.config_host, this.project_root);
		}
		return ts.parseJsonConfigFileContent(
			loaded_config.config,
			this.config_host,
			this.project_root,
			undefined,
			config_file,
		);
	}

	/** Responsibilities: _project base URL_. **/
	private base_url(parsed_config: ts.ParsedCommandLine): string {
		if (parsed_config.options.baseUrl === undefined) {
			return this.project_root;
		}
		return resolve_path(this.project_root, parsed_config.options.baseUrl);
	}

	/** Responsibilities: _compiler path mapping origin_. **/
	private paths_base(parsed_config: ts.ParsedCommandLine): string {
		if (parsed_config.options.baseUrl !== undefined) {
			return this.base_url(parsed_config);
		}
		for (const [option_name, option_value] of Object.entries(parsed_config.options)) {
			if (option_name === "pathsBasePath" && typeof option_value === "string") {
				return resolve_path(this.project_root, option_value);
			}
		}
		return this.project_root;
	}

	/** Responsibilities: _project resolution options_. **/
	private project_options(): TypeScriptModuleResolutionOptions {
		const config_file = resolve_path(this.project_root, TYPESCRIPT_CONFIG_FILE);
		const parsed = this.parsed_config(config_file);
		return {
			base_url: this.base_url(parsed),
			paths_base: this.paths_base(parsed),
			paths: this.path_mappings(parsed.options),
		};
	}

	/** Responsibilities: _project resolution initialization_. **/
	public constructor(project_root: string, source_io: ProjectSourceIOContract) {
		this.project_root = project_root;
		this.source_io = source_io;
		this.config_host = {
			useCaseSensitiveFileNames: true,
			readDirectory: () => [],
			fileExists: (file) => this.source_io.source_available(file),
			readFile: (file) => {
				if (!this.source_io.source_available(file)) {
					return undefined;
				}
				return this.source_io.source_text(file);
			},
		};
	}

	/** Responsibilities: _resolution cache identity_. **/
	public cache_identity(options: TypeScriptModuleResolutionOptions): string {
		return JSON.stringify(options);
	}

	/** Responsibilities: _configuration cache identity_. **/
	public configuration_identity(): string {
		return this.cache_identity(this.project_options());
	}

	/** Responsibilities: _project module resolution_. **/
	public resolution(): TypeScriptModuleResolutionContract {
		const options = this.project_options();
		const cache_key = this.cache_identity(options);
		return new TypeScriptModuleResolutionConfig(options, cache_key);
	}
}
