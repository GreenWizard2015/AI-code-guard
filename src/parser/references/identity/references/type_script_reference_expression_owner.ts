import { INSTANCE_PROPERTY_SIDE } from "src/constants";
import type { TypeScriptReferenceResolutionContract } from "src/model/protocols";
import { TypeScriptReferenceResolution } from "src/model/type_script_reference_resolution";
import { TypeScriptReferenceOwnerQueryKind } from "src/model/types";
import type {
	TypeScriptAccessReferenceRequest,
	TypeScriptMethodReferenceRequest,
	TypeScriptReferenceExpressionOwnerContext,
	TypeScriptReferenceOwnerRequest,
	TypeScriptReferenceOwnerResolverContract,
} from "src/parser/references/identity/references/protocols";
import type { TypeScriptPropertySide } from "src/types";
import ts from "typescript";

/** Responsibilities: _expression owner lookup_, _member reference ownership_. **/
export class TypeScriptReferenceExpressionOwner implements TypeScriptReferenceOwnerResolverContract {
	private readonly _context: TypeScriptReferenceExpressionOwnerContext;

	/** Responsibilities: _member owner fallback_. **/
	private member_owner(base_owner: string, name: string, side: TypeScriptPropertySide): string {
		if (!base_owner) {
			return base_owner;
		}
		if (!name) {
			return base_owner;
		}
		const property_owner = this._context.property_state.property_owner({ owner: base_owner, property: name, side });
		if (property_owner.length > 0) {
			return property_owner;
		}
		const imported_owner = this._context.imported_property_owner.property_owner(base_owner, name);
		if (imported_owner.length > 0) {
			return imported_owner;
		}
		return base_owner;
	}

	/** Responsibilities: _new expression owner resolution_. **/
	private new_instance_owner(new_expression: ts.NewExpression): string {
		if (!ts.isIdentifier(new_expression.expression)) {
			return "";
		}
		const name = new_expression.expression.text;
		const alias = this._context.aliases.get(name);
		if (alias === undefined) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _identifier instance ownership_. **/
	private identifier_owner(identifier: ts.Identifier): string {
		const instance = this._context.instances.instance_owner(identifier.text, identifier);
		if (instance.bound) {
			return instance.value;
		}
		return identifier.text;
	}

	/** Responsibilities: _expression owner dispatch_. **/
	private expression_owner(base_expression: ts.Expression): string {
		if (ts.isCallExpression(base_expression)) {
			return this.call_owner(base_expression.expression);
		}
		if (ts.isPropertyAccessExpression(base_expression) || ts.isElementAccessExpression(base_expression)) {
			return this.method_owner(base_expression);
		}
		if (ts.isNewExpression(base_expression)) {
			return this.new_instance_owner(base_expression);
		}
		if (ts.isIdentifier(base_expression)) {
			return this.identifier_owner(base_expression);
		}
		if (base_expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return "";
		}
		return this._context.this_receiver.owner(base_expression);
	}

	/** Responsibilities: _receiver property side_. **/
	private receiver_side(receiver: ts.Expression): TypeScriptPropertySide {
		if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
			return this._context.this_receiver.side(receiver);
		}
		if (ts.isIdentifier(receiver)) {
			if (this._context.reference_identity.class_receiver(receiver.text)) {
				return "static";
			}
		}
		return INSTANCE_PROPERTY_SIDE;
	}

	/** Responsibilities: _property call owner lookup_. **/
	private property_call_owner(property_call: ts.PropertyAccessExpression): string {
		const owner = this.method_owner(property_call);
		if (!owner) {
			return "";
		}
		const side = this.receiver_side(property_call.expression);
		return this._context.call_returns.owner_for(property_call.name.text, owner, side);
	}

	/** Responsibilities: _access reference resolution_. **/
	private access_reference(request: TypeScriptAccessReferenceRequest): TypeScriptReferenceResolutionContract {
		const owner = this.method_owner(request.expression);
		if (owner.length === 0) {
			return new TypeScriptReferenceResolution(
				owner,
				this._context.reference_identity.member_name(request.expression),
				"",
			);
		}
		const identity = this._context.reference_identity.method_reference(request.expression, owner);
		return new TypeScriptReferenceResolution(owner, identity.name, identity.target_file);
	}

	/** Responsibilities: _call owner_, _property receiver owner_. **/
	private fallback_owner(expression: ts.Expression): string {
		const call_owner = this.call_owner(expression);
		if (call_owner.length > 0) {
			return call_owner;
		}
		return this.property_receiver_owner(expression);
	}

	/** Responsibilities: _reference owner setup_. **/
	public constructor(context: TypeScriptReferenceExpressionOwnerContext) {
		this._context = context;
	}

	/** Responsibilities: _call expression owner lookup_. **/
	public call_owner(callee: ts.Expression): string {
		this._context.initializer.initialize();
		if (ts.isIdentifier(callee)) {
			const instance = this._context.instances.instance_owner(callee.text, callee);
			if (instance.bound) {
				return instance.value;
			}
			return this._context.call_returns.owner_for(callee.text, "", INSTANCE_PROPERTY_SIDE);
		}
		if (!ts.isPropertyAccessExpression(callee)) {
			return "";
		}
		return this.property_call_owner(callee);
	}

	/** Responsibilities: _member expression owner lookup_. **/
	public method_owner(member_access: ts.AccessExpression): string {
		this._context.initializer.initialize();
		const base_owner = this.expression_owner(member_access.expression);
		const side = this.receiver_side(member_access.expression);
		const name = this._context.reference_identity.member_name(member_access);
		return this.member_owner(base_owner, name, side);
	}

	/** Responsibilities: _property receiver owner lookup_. **/
	public property_receiver_owner(property_access: ts.Expression): string {
		if (!ts.isPropertyAccessExpression(property_access)) {
			return "";
		}
		return this.expression_owner(property_access.expression);
	}

	/** Responsibilities: _method reference resolution_. **/
	public resolve_method_reference(request: TypeScriptMethodReferenceRequest): TypeScriptReferenceResolutionContract {
		const expression = request.expression;
		if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
			return this.access_reference({ expression });
		}
		return new TypeScriptReferenceResolution("");
	}

	/** Responsibilities: _reference owner resolution_. **/
	public resolve_owner(request: TypeScriptReferenceOwnerRequest): TypeScriptReferenceResolutionContract {
		switch (request.kind) {
			case TypeScriptReferenceOwnerQueryKind.CallOwner:
				return new TypeScriptReferenceResolution(this.call_owner(request.expression));
			case TypeScriptReferenceOwnerQueryKind.PropertyOwner:
				return new TypeScriptReferenceResolution(this.property_receiver_owner(request.expression));
			case TypeScriptReferenceOwnerQueryKind.CallOrPropertyOwner:
				return new TypeScriptReferenceResolution(this.fallback_owner(request.expression));
			default:
				return new TypeScriptReferenceResolution("");
		}
	}
}
