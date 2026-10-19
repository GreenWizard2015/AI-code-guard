# `local-inheritance`

Description: Inheriting from another project class couples ownership boundaries.

## Bad

```ts
class Reader {}
class CachedReader extends Reader {}
```


**Fix:** Prefer composition and dependency injection; implement a protocol when a shared contract is needed.

## Good

```ts
interface ReaderContract { content_text(): string; }
```

