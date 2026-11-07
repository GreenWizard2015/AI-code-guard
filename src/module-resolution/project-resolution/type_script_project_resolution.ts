import { TypeScriptModuleResolutionConfig } from "src/module-resolution/path-resolution/type_script_module_resolution_config";
import { PackageImportMappings } from "src/module-resolution/project-resolution/package_import_mappings";
import { ProjectResolutionConfiguration } from "src/module-resolution/project-resolution/project_resolution_configuration";
import type { PackageImportMappingsContract } from "src/module-resolution/protocols";
import type {
	TypeScriptModuleResolutionContract,
	TypeScriptModuleResolutionOptions,
} from "src/module-resolution/types";
import type { ProjectSourceContentIOContract } from "src/source_protocols";

/** Responsibilities: _compiler resolution options_, _configuration cache identity_. **/
export class TypeScriptProjectResolution {
	private readonly _configuration: ProjectResolutionConfiguration;
	private readonly _package_imports: PackageImportMappingsContract;
	private readonly _resolutions: Map<string, TypeScriptModuleResolutionContract>;

	/** Responsibilities: _project compiler options_. **/
	private project_options(resolution_mode: string): TypeScriptModuleResolutionOptions {
		const configuration_options = this._configuration.module_options(resolution_mode);
		const package_conditions = new Set(configuration_options.package_conditions);
		const package_mappings = this._package_imports.mappings(package_conditions);
		return {
			...configuration_options,
			paths: [...package_mappings, ...configuration_options.paths],
		};
	}

	/** Responsibilities: _resolution collaborators_. **/
	public constructor(project_root: string, source_io: ProjectSourceContentIOContract) {
		this._configuration = new ProjectResolutionConfiguration(project_root, source_io);
		this._package_imports = new PackageImportMappings(project_root, source_io);
		this._resolutions = new Map<string, TypeScriptModuleResolutionContract>();
	}

	/** Responsibilities: _resolution source inputs_. **/
	public configuration_files(): readonly string[] {
		const source_files = new Set(this._configuration.configuration_files());
		for (const package_file of this._package_imports.source_files()) {
			source_files.add(package_file);
		}
		return [...source_files];
	}

	/** Responsibilities: _options cache key_. **/
	public cache_identity(options: TypeScriptModuleResolutionOptions): string {
		return JSON.stringify(options);
	}

	/** Responsibilities: _project options cache key_. **/
	public configuration_identity(): string {
		return this.cache_identity(this.project_options("import"));
	}

	/** Responsibilities: _module resolution result_. **/
	public resolution(resolution_mode = "import"): TypeScriptModuleResolutionContract {
		const options = this.project_options(resolution_mode);
		const options_identity = this.cache_identity(options);
		const cached_resolution = this._resolutions.get(options_identity);
		if (cached_resolution !== undefined) {
			return cached_resolution;
		}
		const resolution = new TypeScriptModuleResolutionConfig(options, options_identity);
		this._resolutions.set(options_identity, resolution);
		return resolution;
	}
}
