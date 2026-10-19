# `bind`

Description: Avoid `.bind(...)` callback construction.

```ts
const callback = service.run.bind(service);
```

### Alternative

Use an explicit lambda so the receiver and arguments remain visible:

```ts
// File: cli.ts
(function () {
	const callback = (...args: string[]) => service.run(...args);
})();
```

## Bad

```ts
// File: cli.ts
(function () {
	const callback = service.run.bind(service);
})();
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
