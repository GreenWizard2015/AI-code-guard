# `facade-file-content`

Description: Facade files such as `index.ts` and `__init__.py` may contain imports and re-exports only.

## Bad

```ts
// File: src/index.ts
export class Service {}
```


## Good

```ts
// File: src/index.ts
```

