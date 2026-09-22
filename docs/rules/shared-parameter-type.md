# `shared-parameter-type`

**Purpose:** Repeated use of one reference type can indicate that behavior belongs behind one
owned boundary.

The rule builds one node per normalized parameter type and records the exact production callable
locations using it. Top-level functions are analyzed project-wide. Methods are analyzed only
inside their owning class. Test callables and private methods do not contribute support.

Before:

```ts
function load_profile(client: Client): Profile {
  return client.fetch_profile();
}

function save_profile(client: Client, profile: Profile): void {
  client.save_profile(profile);
}

function clear_profile(client: Client): void {
  client.delete_profile();
}

function refresh_profile(client: Client): Promise<Profile> {
  return client.refresh_profile();
}
```

After:

```ts
class ProfileService {
  private readonly client: Client;

  public constructor(client: Client) {
    this.client = client;
  }

  public load(): Profile {
    const profile = this.client.fetch_profile();
    this.client.record_profile_load();
    return profile;
  }

  public save(profile: Profile): void {
    this.client.save_profile(profile);
    this.client.refresh_cache();
    this.client.invalidate_profile_cache();
  }
}
```

**Fix:** Add the shared operation to `Client` when it owns that behavior, or introduce one focused wrapper boundary and update callers to use it. Check production and test callers before moving behavior.

## Choosing the boundary

Do not hide a repeated structural type behind a renamed alias. Create a wrapper when the values
share a domain, lifecycle, or validation contract, then move the common operations into that
wrapper. Keep the wrapper immutable and expose operations that protect its boundary, such as
validation, normalization, copying, or dispatch.

Before introducing a wrapper, classify every candidate by meaning:

- Use one wrapper when the same value represents the same domain concept and callers perform the
  same operations.
- Use separate wrappers when the same structural type represents different concepts, such as
  tool arguments, an MCP envelope, task data, or a Relay record.
- Do not combine unrelated `JsonValue` or `JsonObject` functions only to silence this diagnostic.
  A broad structural type is evidence to inspect, not proof that one class should own everything.

Good boundary:

```python
@dataclass(frozen=True, slots=True)
class TaskData:
    value: JsonObject

    def validate(self) -> None:
        ...

    def as_object(self) -> JsonObject:
        return self.value
```

The caller passes `TaskData` to task-record construction, and reserved-key validation remains
owned by the task-data boundary.

For a shared JSON value, keep the structural `JsonValue` visible and wrap the value at the
operation boundary. The wrapper should own the repeated runtime checks and conversions instead of
forcing every caller to repeat them.

Before:

```python
def read_name(value: JsonValue) -> str:
    if type(value) is str:
        return value
    return ''

def read_count(value: JsonValue) -> int:
    if type(value) is int:
        return value
    return 0
```

After:

```python
@dataclass(frozen=True, slots=True)
class JsonValueInspector:
    value: JsonValue

    def string_value(self) -> str:
        if type(self.value) is not str:
            return ''
        return self.value

    def integer_value(self) -> int:
        if type(self.value) is not int:
            return 0
        return self.value
```

Use one real module-level constructor for the boundary when validation is needed, and keep the
wrapper immutable. Do not replace it with a renamed alias, a fake object, or several forwarding
functions. If two callers use the same structural value for different domains, create separate
wrappers and move only domain-specific operations into each one.

The same ownership rule applies to infrastructure context: consumers depend on a narrow
`LintProjectContext` interface while construction remains in `LintProjectContextStore`.

Bad boundary:

```python
JsonPayload = JsonObject

def parse_task(value: JsonPayload): ...
def parse_relay_record(value: JsonPayload): ...
```

This only renames the structural type and leaves unrelated operations outside an owner. Prefer
distinct wrappers or narrow domain protocols after checking all production callers.

Imported aliases are normalized to the original type. Basic parameters never produce this
diagnostic on their own; they can participate only in a supported mixed combination.

Typed boundary example:

```ts
// The defining owner exposes a named contract.
interface ToolRegistryPort {
  list(): Tool[];
}

function install(registry: ToolRegistryPort): void {}
```
