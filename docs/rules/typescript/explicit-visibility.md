# `explicit-visibility`

Description: Implicit TypeScript visibility hides the public API.

```ts
class Client {
  private readonly endpoint = '/messages';

  public send(): void {
    this.endpoint;
  }
}
```


Fix: Declare `public`, `protected`, or `private` on every class field and method.

## Bad

```ts
class MessageQueue {
	items: string[] = [];
	append(item: string): void { this.items.push(item); }
}
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
