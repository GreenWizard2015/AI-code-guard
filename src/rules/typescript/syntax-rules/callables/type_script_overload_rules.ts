import ts from "typescript";
import { TypeScriptOverloadSiblingNames } from "src/rules/typescript/syntax-rules/callables/type_script_overload_sibling_names";
import type { TypeScriptOverloadSiblingNamesContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _overload rules_, _signature checks_. **/
export class TypeScriptOverloadRules {
	private readonly overload_cache: WeakMap<ts.Node, boolean>;
	private readonly sibling_names: WeakMap<ts.Node, TypeScriptOverloadSiblingNamesContract>;
	private readonly sibling_parent_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly function_parent_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly class_parent_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly contract_parent_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _function declaration overload resolution_. **/
	private function_overload_result(node: ts.FunctionDeclaration): boolean {
		if (node.body !== undefined || node.name === undefined) {
			this.overload_cache.set(node, false);
			return false;
		}
		const parent = node.parent;
		if (!this.function_parent_kinds.has(parent.kind)) {
			this.overload_cache.set(node, false);
			return false;
		}
		const count = this.sibling_index(parent).function_declaration_count(node.name.getText());
		const result = count > 1;
		this.overload_cache.set(node, result);
		return result;
	}

	/** Responsibilities: _sibling overload index_. **/
	private sibling_index(parent: ts.Node): TypeScriptOverloadSiblingNamesContract {
		const cached = this.sibling_names.get(parent);
		if (cached !== undefined) {
			return cached;
		}
		const index = new TypeScriptOverloadSiblingNames();
		if (this.sibling_parent_kinds.has(parent.kind)) {
			parent.forEachChild((declaration) => index.append(declaration));
		}
		this.sibling_names.set(parent, index);
		return index;
	}

	/** Responsibilities: _overload index initialization_. **/
	public constructor() {
		this.overload_cache = new WeakMap<ts.Node, boolean>();
		this.sibling_names = new WeakMap<ts.Node, TypeScriptOverloadSiblingNamesContract>();
		this.sibling_parent_kinds = new Set([
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.ModuleBlock,
			ts.SyntaxKind.Block,
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeLiteral,
		]);
		this.function_parent_kinds = new Set([ts.SyntaxKind.SourceFile, ts.SyntaxKind.ModuleBlock, ts.SyntaxKind.Block]);
		this.class_parent_kinds = new Set([ts.SyntaxKind.ClassDeclaration, ts.SyntaxKind.ClassExpression]);
		this.contract_parent_kinds = new Set([ts.SyntaxKind.InterfaceDeclaration, ts.SyntaxKind.TypeLiteral]);
	}

	/** Responsibilities: _function overload detection_. **/
	public function_overload(node: ts.FunctionDeclaration): boolean {
		if (this.overload_cache.has(node)) {
			return this.overload_cache.get(node) === true;
		}
		return this.function_overload_result(node);
	}

	/** Responsibilities: _class method overload detection_. **/
	public class_method_overload(node: ts.MethodDeclaration): boolean {
		if (this.overload_cache.has(node)) {
			return this.overload_cache.get(node) === true;
		}
		if (node.body !== undefined || node.name === undefined) {
			this.overload_cache.set(node, false);
			return false;
		}
		const parent = node.parent;
		if (!this.class_parent_kinds.has(parent.kind)) {
			this.overload_cache.set(node, false);
			return false;
		}
		const result = this.sibling_index(parent).implemented_method_count(node.name.getText()) > 0;
		this.overload_cache.set(node, result);
		return result;
	}

	/** Responsibilities: _contract method overload detection_. **/
	public interface_method_overload(node: ts.MethodSignature): boolean {
		if (this.overload_cache.has(node)) {
			return this.overload_cache.get(node) === true;
		}
		if (node.name === undefined) {
			this.overload_cache.set(node, false);
			return false;
		}
		const parent = node.parent;
		if (!this.contract_parent_kinds.has(parent.kind)) {
			this.overload_cache.set(node, false);
			return false;
		}
		const count = this.sibling_index(parent).interface_method_count(node.name.getText());
		const result = count > 1;
		this.overload_cache.set(node, result);
		return result;
	}
}
