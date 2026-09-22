# `typescript-bind`

Avoid `.bind(...)` callback construction.

```ts
const callback = service.run.bind(service);
```

Use an explicit lambda so the receiver and arguments remain visible:

```ts
const callback = (...args: string[]) => service.run(...args);
```
