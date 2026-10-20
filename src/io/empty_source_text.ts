import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _empty source inventory_, _unavailable source results_. **/
export class EmptySourceText implements ProjectSourceIOContract {
	/** Responsibilities: _empty source inventory_. **/
	public source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[] {
		void root;
		void ignored_directories;
		return [];
	}

	/** Responsibilities: _unavailable source check_. **/
	public source_available(file: string): boolean {
		void file;
		return false;
	}

	/** Responsibilities: _empty source lookup_. **/
	public source_text(file: string): string {
		void file;
		return "";
	}
}
