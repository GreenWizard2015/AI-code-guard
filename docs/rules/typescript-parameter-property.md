# Explicit Constructor Fields

TypeScript constructor parameter properties combine a parameter and a class field in one
declaration. Keep the field declaration and constructor assignment explicit so ownership and
initialization remain visible.

```ts
class Client {
  constructor(private readonly transport: Transport) {}
}
```

```ts
class Client {
  private readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }
}
```
