# `nullable-domain-type`

**Purpose:** Do not use `null`, `undefined`, `void`, `never`, `unknown`, `any`, or `Optional` as a field, parameter, or return boundary. This applies to domain and primitive types.

**Bad:**

```ts
class UserView {
	public readonly user: User | null;
	public readonly label: string | null;
	public find_user(id: string): User | undefined {
		return undefined;
	}
}
```

```py
class UserView:
    user: Optional[User]
    label: Optional[str]

    def find_user(self, user_id: str) -> User | None:
        return None
```

**Fix:** Replace each nullable boundary type with an explicit state contract and specialized classes.

```ts
interface User {
	exists(): boolean;
}

class FoundUser implements User {
	public exists(): boolean {
		return true;
	}
}
```

```ts
class EmptyUser implements User {
	public exists(): boolean {
		return false;
	}
}
```

```py
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    user_id: str

    def exists(self) -> bool:
        return self.user_id != ''
```

```py
from dataclasses import dataclass


@dataclass(frozen=True)
class EmptyUser:
    reason: str = 'not found'

    def exists(self) -> bool:
        return False
```

For primitive values, use equivalent states such as `PresentLabel | EmptyLabel` instead of `string | null`. Use names that describe the real states, for example `NotFoundUser` or `EmptyUser`.

Do not replace nullability with a composite state union. Explicit discriminants and required fields do not make a union a class contract:

```ts
type BridgeResult =
	| { readonly kind: 'success'; readonly status: number; readonly stdout: string }
	| { readonly kind: 'failure'; readonly status: number; readonly error: Error };
```

A field union such as `stderr: Buffer | string` is also prohibited. Define one interface and specialized classes for each representation or state:

```ts
interface BridgeOutput {
	text(): string;
}

class BufferBridgeOutput implements BridgeOutput {
	public text(): string {
		return '';
	}
}

class StringBridgeOutput implements BridgeOutput {
	public text(): string {
		return '';
	}
}
```

Do not replace this with a shared object whose `error` field is `Error | undefined`, or with two branches that differ only by optional fields.

## JSON-RPC tool responses

Keep JSON-RPC serialization at the transport boundary. Do not use a broad
`JsonRpcResponse` object with optional `jsonrpc`, `id`, `result`, and `error`
fields throughout production code. Model each outgoing response state with a
separate class and expose one `payload()` method for serialization:

```py
@dataclass(frozen=True, slots=True)
class ToolResponse:
    request_id: JsonRpcId
    result: JsonValue

    def payload(self) -> JsonObject:
        return {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "result": self.result,
        }


@dataclass(frozen=True, slots=True)
class ToolErrorResponse:
    request_id: JsonRpcId
    code: str
    message: str

    def payload(self) -> JsonObject:
        return {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "error": {"code": self.code, "message": self.message},
        }
```

Send the serialized payload only at the HTTP or bridge boundary:

```py
response = ToolResponse(request_id, result)
return McpResponse(HTTPStatus.OK, response.payload(), None)
```

The wire format may contain optional protocol members when the external
specification requires them, but those members must not be used as nullable
domain state inside the application.
