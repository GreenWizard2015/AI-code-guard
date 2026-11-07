import { PYTHON_TESTCASE_BASE, PYTHON_UNITTEST_FRAMEWORK } from "src/constants";
import type { AstPythonImport, AstReferenceAlias } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _Python framework import resolution_, _unittest base identification_. **/
export class PythonTestFrameworkIdentity {
	private readonly _aliases: readonly AstReferenceAlias[];
	private readonly _imports: readonly AstPythonImport[];

	/** Responsibilities: _identity initialization_. **/
	public constructor(aliases: readonly AstReferenceAlias[], imports: readonly AstPythonImport[] = []) {
		this._aliases = aliases;
		this._imports = imports;
	}

	/** Responsibilities: _framework import resolution_. **/
	public resolve_import(name: string): string {
		for (const imported of this._imports) {
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
	public resolve(name: string): string {
		let resolved = this.resolve_import(name);
		const seen = new Set<string>();
		while (!seen.has(resolved)) {
			seen.add(resolved);
			const alias = this._aliases.find(
				(candidate) => resolved === candidate.name || resolved.startsWith(`${candidate.name}.`),
			);
			if (alias === undefined) {
				return resolved;
			}
			resolved = `${alias.target}${resolved.slice(alias.name.length)}`;
		}
		return resolved;
	}
}
