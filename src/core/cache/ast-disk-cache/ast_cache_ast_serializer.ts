import type { AstCacheAst, AstCacheAstModuleMetadata, AstCacheAstReferences } from "src/cache_types";
import type { AstTypeMembers, AstTypeMembersSerialized, NormalizedAstFile } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _AST cache representation_, _cache metadata contracts_. **/
export class AstCacheAstSerializer {
	private readonly _ast: NormalizedAstFile;

	/** Responsibilities: _type-member data_. **/
	private type_members(members: AstTypeMembers): AstTypeMembersSerialized {
		return Array.from(members, ([name, record]) => ({
			name,
			members: Array.from(record, ([member_name, type]) => ({ name: member_name, type })),
		}));
	}

	/** Responsibilities: _AST state initialization_. **/
	public constructor(ast: NormalizedAstFile) {
		this._ast = ast;
	}

	/** Responsibilities: _AST references_. **/
	public references(): AstCacheAstReferences {
		return {
			attribute_accesses: this._ast.references.attribute_accesses,
			named_symbols: this._ast.references.named_symbols,
			type_declarations: this._ast.references.type_declarations,
			symbol_references: this._ast.references.symbol_references,
			literal_references: this._ast.references.literal_references,
			literal_constants: this._ast.references.literal_constants,
			reference_aliases: this._ast.references.reference_aliases,
			call_references: this._ast.references.call_references,
			type_members: this.type_members(this._ast.references.type_members),
		};
	}

	/** Responsibilities: _module metadata_. **/
	public module_metadata(): AstCacheAstModuleMetadata {
		return {
			module_constant_spans: this._ast.module_declarations.module_constant_spans,
			module_type_spans: this._ast.module_declarations.module_type_spans,
			module_protocol_spans: this._ast.module_declarations.module_protocol_spans,
			responsibility_targets: this._ast.module_declarations.responsibility_targets,
			python_exports: this._ast.module_declarations.python_exports,
			python_callable_count: this._ast.module_declarations.python_callable_count,
			python_main_guard: this._ast.module_declarations.python_main_guard,
			docstring_spans: this._ast.module_declarations.docstring_spans,
		};
	}

	/** Responsibilities: _AST cache value_. **/
	public value(): AstCacheAst {
		return {
			source: { ...this._ast.source },
			references: this.references(),
			control_flow: { ...this._ast.control_flow },
			module_declarations: this.module_metadata(),
		};
	}
}
