# `explicit-return-type`

Description: Require every named callable to declare its result type explicitly in both
TypeScript and Python. The rule covers functions, methods, getters, and
interface methods. Constructors, setters, and anonymous callback functions are
excluded because they do not define an independent result boundary.

```ts
// Bad
function load_user(user_id: string) {
  return repository.find(user_id);
}

// Good
function load_user(user_id: string): User {
  return repository.find(user_id);
}
```


`__init__` must use `-> None`. Do not rely on inference at a callable boundary;
use `None`, `Result`, or another explicit domain result contract.

## Bad

```ts
function read_value(value: string) { return value; }
```


## Good

```ts
// File: cli.ts
/** Responsibilities: _value reading_. **/
function read_value(value: string): string { return value; }

(function () {
	console.log(read_value("ready"));
})();
```

