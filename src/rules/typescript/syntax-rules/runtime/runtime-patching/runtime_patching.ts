import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import {
	OBJECT_ASSIGN_METHOD_NAME,
	OBJECT_DEFINE_PROPERTY_METHOD_NAME,
	OBJECT_PATCH_OWNER_NAME,
	PATCH_DESCRIPTOR_KEYS,
	PATCH_DESCRIPTOR_OWNERS,
	REFLECT_PATCH_OWNER_NAME,
	REFLECT_SET_METHOD_NAME,
} from "src/rules/typescript/syntax-rules/runtime/runtime-patching/constants";
import { InheritedMethodReplacement } from "src/rules/typescript/syntax-rules/runtime/runtime-patching/inherited_method_replacement";
import { RuntimePatchAliasIndex } from "src/rules/typescript/syntax-rules/runtime/runtime-patching/runtime_patch_alias_index";
import type {
	RuntimePatchAliasIndexContract,
	RuntimePatchAliases,
} from "src/rules/typescript/syntax-rules/runtime/runtime-patching/types";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _patch call classification_, _callable replacement detection_. **/
export class RuntimePatching {
	private readonly _aliases_by_source: RuntimePatchAliases;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _source alias index lookup_. **/
	private alias_index(context_node: ts.Node): RuntimePatchAliasIndexContract {
		const source = context_node.getSourceFile();
		const cached = this._aliases_by_source.get(source);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new RuntimePatchAliasIndex(source, this._declaration_index);
		aliases.collect();
		this._aliases_by_source.set(source, aliases);
		return aliases;
	}

	/** Responsibilities: _descriptor callable replacement classification_. **/
	private descriptor_property(property: ts.ObjectLiteralElementLike): boolean {
		if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
			return false;
		}
		if (!PATCH_DESCRIPTOR_KEYS.has(property.name.text)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _property descriptor replacement classification_. **/
	private define_property(descriptor_call: ts.CallExpression): boolean {
		if (descriptor_call.expression.kind !== ts.SyntaxKind.PropertyAccessExpression) {
			return false;
		}
		const descriptor = descriptor_call.arguments[2];
		if (descriptor === undefined || !ts.isObjectLiteralExpression(descriptor)) {
			return false;
		}
		return descriptor.properties.some((property) => this.descriptor_property(property));
	}

	/** Responsibilities: _bulk callable replacement classification_. **/
	private object_assign(assignment_call: ts.CallExpression): boolean {
		for (const source of assignment_call.arguments.slice(1)) {
			if (!ts.isObjectLiteralExpression(source)) {
				continue;
			}
			if (source.properties.length > 0) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _Object mutation classification_. **/
	private object_patch(mutation_call: ts.CallExpression, method: string): boolean {
		if (method === OBJECT_ASSIGN_METHOD_NAME) {
			return this.object_assign(mutation_call);
		}
		if (method === OBJECT_DEFINE_PROPERTY_METHOD_NAME) {
			return this.define_property(mutation_call);
		}
		return false;
	}

	/** Responsibilities: _descriptor mutation classification_. **/
	private descriptor_patch(patch_call: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(patch_call.expression)) {
			return false;
		}
		if (!ts.isIdentifier(patch_call.expression.expression)) {
			return false;
		}
		const owner = patch_call.expression.expression.text;
		const method = patch_call.expression.name.text;
		return this.owner_patch(patch_call, owner, method);
	}

	/** Responsibilities: _mutation owner dispatch_. **/
	private owner_patch(patch_call: ts.CallExpression, owner: string, method: string): boolean {
		if (!PATCH_DESCRIPTOR_OWNERS.has(owner)) {
			return false;
		}
		if (owner === OBJECT_PATCH_OWNER_NAME) {
			return this.object_patch(patch_call, method);
		}
		if (owner !== REFLECT_PATCH_OWNER_NAME) {
			return false;
		}
		if (method !== REFLECT_SET_METHOD_NAME) {
			return false;
		}
		return patch_call.arguments[2] !== undefined;
	}

	/** Responsibilities: _constructor method identity lookup_. **/
	private constructor_member(member: ts.ClassElement, field_name: string): boolean {
		const callable_member =
			ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member);
		if (!callable_member) {
			return false;
		}
		if (member.name === undefined || !ts.isIdentifier(member.name)) {
			return false;
		}
		return member.name.text === field_name;
	}

	/** Responsibilities: _constructor field member lookup_. **/
	private constructor_has_member(constructor_node: ts.ConstructorDeclaration, field_name: string): boolean {
		const owner = constructor_node.parent;
		const class_owner = ts.isClassDeclaration(owner) || ts.isClassExpression(owner);
		if (!class_owner) {
			return false;
		}
		return owner.members.some((member) => this.constructor_member(member, field_name));
	}

	/** Responsibilities: _constructor field initialization classification_. **/
	private constructor_field_initialization(expression: ts.BinaryExpression): boolean {
		const target = expression.left;
		if (!ts.isPropertyAccessExpression(target) || target.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		let owner: ts.Node | undefined = expression.parent;
		while (owner !== undefined) {
			if (ts.isConstructorDeclaration(owner)) {
				return !this.constructor_has_member(owner, target.name.text);
			}
			if (ts.isFunctionLike(owner)) {
				return false;
			}
			owner = owner.parent;
		}
		return false;
	}

	/** Responsibilities: _patch analyzer initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._aliases_by_source = new WeakMap<ts.SourceFile, RuntimePatchAliasIndex>();
		this._declaration_index = declaration_index;
	}

	/** Responsibilities: _patch API call analysis_. **/
	public patch_call(api_call: ts.CallExpression): boolean {
		if (this.alias_index(api_call).framework_patch(api_call)) {
			return true;
		}
		return this.descriptor_patch(api_call);
	}

	/** Responsibilities: _callable member assignment analysis_. **/
	public function_assignment(expression: ts.BinaryExpression): boolean {
		if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		const property_target = ts.isPropertyAccessExpression(expression.left);
		const indexed_target = ts.isElementAccessExpression(expression.left);
		if (!property_target && !indexed_target) {
			return false;
		}
		if (this.constructor_field_initialization(expression)) {
			return false;
		}
		return this.alias_index(expression).callable_replacement(expression.right);
	}

	/** Responsibilities: _test inheritance replacement detection_. **/
	public patch_test_node(
		syntax_node: ts.Node,
		module_resolver: TypeScriptModuleExportsContract,
		source_resolver: SourceFileResolver,
	): boolean {
		if (ts.isClassDeclaration(syntax_node) || ts.isClassExpression(syntax_node)) {
			const inherited_method = new InheritedMethodReplacement(syntax_node, module_resolver, source_resolver);
			inherited_method.collect_imported_names();
			if (!inherited_method.extends_imported_class()) {
				return false;
			}
			return inherited_method.overrides_member();
		}
		return this.patch_node(syntax_node);
	}

	/** Responsibilities: _AST node patch analysis_. **/
	public patch_node(syntax_node: ts.Node): boolean {
		if (ts.isCallExpression(syntax_node)) {
			return this.patch_call(syntax_node);
		}
		if (ts.isBinaryExpression(syntax_node)) {
			return this.function_assignment(syntax_node);
		}
		return false;
	}
}
