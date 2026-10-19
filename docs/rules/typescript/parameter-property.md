# Explicit Constructor Fields

Description: TypeScript constructor parameter properties combine a parameter and a class field in one
declaration. Keep the field declaration and constructor assignment explicit so ownership and
initialization remain visible.

### Replacement

```ts
class Client {
  constructor(private readonly transport: Transport) {}
}
```

### Replacement

```ts
class Client {
  private readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }
}
```

## Bad

```ts
class Client {
	public constructor(private readonly transport: Transport) {}
}
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
