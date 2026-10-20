import type { AstPythonImport, AstReferenceAlias } from "src/types";
import { PYTHON_TESTCASE_BASE, PYTHON_UNITTEST_FRAMEWORK } from "src/constants";

/** Responsibilities: _Python framework import resolution_, _unittest base identification_. **/
export class PythonTestFrameworkIdentity {
	private readonly aliases: readonly AstReferenceAlias[];
	private readonly imports: readonly AstPythonImport[];

	/** Responsibilities: _framework import target resolution_. **/
	private imported_target(name: string): string {
		for (const imported of this.imports) {
			for (const imported_name of imported.names) {
				if (imported_name.alias !== name && imported_name.name !== name) {
					continue;
				}
				if (imported.module !== PYTHON_UNITTEST_FRAMEWORK || imported_name.name !== "TestCase") {
					continue;
				}
				return PYTHON_TESTCASE_BASE;
			}
		}
		return name;
	}

	/** Responsibilities: _alias-chain resolution_. **/
	private resolve(name: string): string {
		let resolved = this.imported_target(name);
		const seen = new Set<string>();
		while (!seen.has(resolved)) {
			seen.add(resolved);
			const alias = this.aliases.find(
				(candidate) => resolved === candidate.name || resolved.startsWith(`${candidate.name}.`),
			);
			if (alias === undefined) {
				return resolved;
			}
			resolved = `${alias.target}${resolved.slice(alias.name.length)}`;
		}
		return resolved;
	}

	/** Responsibilities: _identity initialization_. **/
	public constructor(aliases: readonly AstReferenceAlias[], imports: readonly AstPythonImport[] = []) {
		this.aliases = aliases;
		this.imports = imports;
	}

	/** Responsibilities: _framework identity matching_. **/
	public framework_matches(name: string, expected: string): boolean {
		const resolved = this.resolve(name);
		return resolved === expected;
	}

	/** Responsibilities: _unittest base classification_. **/
	public unittest_base(name: string): boolean {
		return this.framework_matches(name, PYTHON_TESTCASE_BASE);
	}
}
