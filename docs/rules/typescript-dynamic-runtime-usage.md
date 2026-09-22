# `typescript-dynamic-runtime-usage`

## Purpose

Reflective and dynamic runtime APIs hide the contract that static analysis should be able to
resolve. This rule reports `Reflect.*`, `Proxy`, computed access through a string key, and
`key in value`, and `Object.hasOwn`/`Object.prototype.hasOwnProperty.call`, unless the right-hand side is explicitly typed as `Map`, `Set`, `WeakMap`, or
`WeakSet` in TypeScript.

## Bad

```ts
Reflect.get(target, 'value');
const setter = Reflect.set;
new Proxy(target, handler);
const value = target[name_string];
if (name_string in target) {
  return target[name_string];
}
Object.prototype.hasOwnProperty.call(target, name_string);
```

`eval` and `Function` are allowed by this rule.

## Preferred

```ts
interface ValueReader {
  read_value(): string;
}

class TypedValueReader implements ValueReader {
  private readonly target: { value: string };

  public constructor(target: { value: string }) {
    this.target = target;
  }

  public read_value(): string {
    return this.target.value;
  }
}
```

Use an explicit class, interface, or typed operation instead of reflective or dynamic runtime
access. For collection membership, use `collection.has(key)`.
