import { relative, resolve } from "node:path";
import { TEST_PATH_SUFFIXES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type {
	AgentPackageBinContract,
	AgentPackagePathKinds,
	AgentPackagePathScopeRequest,
	AgentPackagePathSelection,
	AgentPackagePlan,
	AgentPackagePlanLayoutRequest,
	AgentPackagePlanRequest,
	AgentWorkPackage,
	AgentWorkPackageBuildRequest,
} from "src/task_selection_types";
import type { TestTargetLink } from "src/task_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _package scope ownership_, _work package assembly_. **/
export class AgentPackagePlanLayout {
	private readonly _root: string;
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _file-to-package ownership index_. **/
	private file_owners(bins: readonly AgentPackageBinContract[]): Map<string, number> {
		const owners = new Map<string, number>();
		for (const bin of bins) {
			const units = bin.units();
			for (const unit of units) {
				for (const file of unit.files) {
					owners.set(file, bin.package_number());
				}
			}
		}
		return owners;
	}

	/** Responsibilities: _candidate ancestor directories_. **/
	private candidate_directories(files: readonly string[]): string[] {
		const candidate_directories = new Set<string>();
		for (const file of files) {
			const segments = file.split("/");
			for (let length = 2; length < segments.length; length += 1) {
				candidate_directories.add(segments.slice(0, length).join("/"));
			}
		}
		const ordered_directories = [...candidate_directories];
		ordered_directories.sort((left, right) => {
			const depth_difference = left.split("/").length - right.split("/").length;
			if (depth_difference !== 0) {
				return depth_difference;
			}
			return left.localeCompare(right);
		});
		return ordered_directories;
	}

	/** Responsibilities: _single-owner directory files_. **/
	private directory_files(
		package_number: number,
		owners_by_file: ReadonlyMap<string, number>,
		directory: string,
	): string[] {
		const descendants: string[] = [];
		for (const [file, owner] of owners_by_file) {
			if (!file.startsWith(`${directory}/`)) {
				continue;
			}
			if (owner !== package_number) {
				return [];
			}
			descendants.push(file);
		}
		if (descendants.length < 2) {
			return [];
		}
		return descendants;
	}

	/** Responsibilities: _directory scope ownership_. **/
	private directory_path_scopes(
		request: AgentPackagePathScopeRequest,
		scopes: string[],
		covered_files: Set<string>,
	): void {
		const directories = this.candidate_directories(request.files);
		for (const directory of directories) {
			const parent_scope_present = scopes.some((scope) => {
				return scope.endsWith("/") && directory.startsWith(scope);
			});
			if (parent_scope_present) {
				continue;
			}
			const descendants = this.directory_files(request.package_number, request.owners_by_file, directory);
			if (descendants.length === 0) {
				continue;
			}
			for (const file of descendants) {
				covered_files.add(file);
			}
			scopes.push(`${directory}/`);
		}
	}

	/** Responsibilities: _minimal path scopes_. **/
	private path_scopes(request: AgentPackagePathScopeRequest): string[] {
		const scopes: string[] = [];
		const covered_files = new Set<string>();
		this.directory_path_scopes(request, scopes, covered_files);
		for (const file of request.files) {
			if (!covered_files.has(file)) {
				scopes.push(file);
			}
		}
		return scopes.sort();
	}

	/** Responsibilities: _production and test paths_. **/
	private path_kinds(files: readonly string[]): AgentPackagePathKinds {
		const production_paths: string[] = [];
		const test_paths: string[] = [];
		for (const file of files) {
			if (this._test_path_syntax.classify(file).has(TestPathKind.TestFile)) {
				test_paths.push(file);
			} else {
				production_paths.push(file);
			}
		}
		return { production_paths, test_paths };
	}

	/** Responsibilities: _linked production paths_. **/
	private linked_production_files(link: TestTargetLink, files: ReadonlySet<string>): string[] {
		const production_files: string[] = [];
		for (const file of link.production_files) {
			const normalized_file = relative(this._root, resolve(this._root, file)).replaceAll("\\", "/");
			if (files.has(normalized_file)) {
				production_files.push(normalized_file);
			}
		}
		return production_files;
	}

	/** Responsibilities: _package test targets_. **/
	private package_links(request: AgentPackagePathSelection): TestTargetLink[] {
		const selected_links: TestTargetLink[] = [];
		for (const link of request.links) {
			const test_file = relative(this._root, resolve(this._root, link.test_file)).replaceAll("\\", "/");
			if (!request.files.has(test_file)) {
				continue;
			}
			const production_files = this.linked_production_files(link, request.files);
			if (production_files.length === 0) {
				continue;
			}
			selected_links.push({ test_file, production_files });
		}
		return selected_links;
	}

	/** Responsibilities: _package diagnostic collection_. **/
	private package_violations(bin: AgentPackageBinContract): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const unit of bin.units()) {
			violations.push(...unit.violations);
		}
		return violations;
	}

	/** Responsibilities: _package file collection_. **/
	private package_files(bin: AgentPackageBinContract): string[] {
		const files = new Set<string>();
		for (const unit of bin.units()) {
			for (const file of unit.files) {
				files.add(file);
			}
		}
		const ordered_files = [...files];
		ordered_files.sort();
		return ordered_files;
	}

	/** Responsibilities: _single package details_. **/
	private work_package(request: AgentWorkPackageBuildRequest): AgentWorkPackage {
		const { bin } = request;
		const violations = this.package_violations(bin);
		const ordered_files = this.package_files(bin);
		const package_files = new Set(ordered_files);
		const paths = this.path_kinds(ordered_files);
		return {
			number: bin.package_number(),
			violations,
			files: ordered_files,
			production_paths: paths.production_paths,
			test_paths: paths.test_paths,
			path_scopes: this.path_scopes({
				package_number: bin.package_number(),
				files: ordered_files,
				owners_by_file: request.owners_by_file,
			}),
			test_target_links: this.package_links({ files: package_files, links: request.links }),
		};
	}

	/** Responsibilities: _package root paths_. **/
	public constructor(root: string) {
		this._root = resolve(root);
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
	}

	/** Responsibilities: _package scopes_. **/
	public work_packages(request: AgentPackagePlanLayoutRequest): AgentWorkPackage[] {
		const owners = this.file_owners(request.bins);
		const packages: AgentWorkPackage[] = [];
		for (const bin of request.bins) {
			packages.push(this.work_package({ bin, owners_by_file: owners, links: request.links }));
		}
		packages.sort((left, right) => left.number - right.number);
		return packages;
	}

	/** Responsibilities: _package plan_. **/
	public plan(request: AgentPackagePlanRequest, packages: readonly AgentWorkPackage[]): AgentPackagePlan {
		return {
			requested_count: request.requested_count,
			batch_size: request.batch_size,
			unresolved_partition_constraints: request.unresolved_partition_constraints,
			excluded_findings: request.excluded_findings,
			packages,
		};
	}
}
