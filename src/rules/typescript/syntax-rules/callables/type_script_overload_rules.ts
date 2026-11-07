import { TypeScriptOverloadSiblingNames } from "src/rules/typescript/syntax-rules/callables/type_script_overload_sibling_names";
import type { TypeScriptOverloadSiblingNamesContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _overload rules_, _signature checks_. **/
export class TypeScriptOverloadRules {
	private readonly _overload_cache: WeakMap<ts.Node, boolean>;
	private readonly _sibling_names: WeakMap<ts.Node, TypeScriptOverloadSiblingNamesContract>;
	private readonly _sibling_parent_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _function_parent_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _class_parent_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _contract_parent_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _function declaration overload resolution_. **/
	private function_overload_result(node: ts.FunctionDeclaration): boolean {
		if (node.body !== undefined || node.name === undefined) {
			this._overload_cache.set(node, false);
			return false;
		}
		const parent = node.parent;
		if (!this._function_parent_kinds.has(parent.kind)) {
			this._overload_cache.set(node, false);
			return false;
		}
		const result = this.sibling_index(parent).counts(node.name.getText()).function_declarations > 1;
		this._overload_cache.set(node, result);
		return result;
	}

	/** Responsibilities: _sibling overload index_. **/
	private sibling_index(parent: ts.Node): TypeScriptOverloadSiblingNamesContract {
		const cached = this._sibling_names.get(parent);
		if (cached !== undefined) {
			return cached;
		}
		const index = new TypeScriptOverloadSiblingNames();
		if (this._sibling_parent_kinds.has(parent.kind)) {
			parent.forEachChild((declaration) => index.append(declaration));
		}
		this._sibling_names.set(parent, index);
		return index;
	}

	/** Responsibilities: _overload index initialization_. **/
	public constructor() {
		this._overload_cache = new WeakMap<ts.Node, boolean>();
		this._sibling_names = new WeakMap<ts.Node, TypeScriptOverloadSiblingNamesContract>();
		this._sibling_parent_kinds = new Set([
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.ModuleBlock,
			ts.SyntaxKind.Block,
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeLiteral,
		]);
		this._function_parent_kinds = new Set([ts.SyntaxKind.SourceFile, ts.SyntaxKind.ModuleBlock, ts.SyntaxKind.Block]);
		this._class_parent_kinds = new Set([ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.ClassExpression]);
		this._contract_parent_kinds = new Set([ts.SyntaxKind.InterfaceDeclaration, ts.SyntaxKind.TypeLiteral]);
	}

	/** Responsibilities: _function overload detection_. **/
	public function_overload(node: ts.FunctionDeclaration): boolean {
		if (this._overload_cache.has(node)) {
			return this._overload_cache.get(node) === true;
		}
		return this.function_overload_result(node);
	}

	/** Responsibilities: _class method overload detection_. **/
	public class_method_overload(node: ts.MethodDeclaration): boolean {
		if (this._overload_cache.has(node)) {
			return this._overload_cache.get(node) === true;
		}
		if (node.body !== undefined || node.name === undefined) {
			this._overload_cache.set(node, false);
			return false;
		}
		const parent = node.parent;
		if (!this._class_parent_kinds.has(parent.kind)) {
			this._overload_cache.set(node, false);
			return false;
		}
		const result = this.sibling_index(parent).counts(node.name.getText()).implemented_methods > 0;
		this._overload_cache.set(node, result);
		return result;
	}

	/** Responsibilities: _contract method overload detection_. **/
	public interface_method_overload(node: ts.MethodSignature): boolean {
		if (this._overload_cache.has(node)) {
			return this._overload_cache.get(node) === true;
		}
		if (node.name === undefined) {
			this._overload_cache.set(node, false);
			return false;
		}
		const parent = node.parent;
		if (!this._contract_parent_kinds.has(parent.kind)) {
			this._overload_cache.set(node, false);
			return false;
		}
		const result = this.sibling_index(parent).counts(node.name.getText()).interface_methods > 1;
		this._overload_cache.set(node, result);
		return result;
	}
}
