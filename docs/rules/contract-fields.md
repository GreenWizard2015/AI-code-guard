# Interface And Protocol Fields

## Purpose

Interfaces and Python `Protocol` classes define behavior boundaries. Data fields put state in
the contract and force every implementation to share representation.

## Bad

```ts
interface UserStore {
  cache: Map<string, string>;
  get(id: string): string;
}
```

```python
class UserStore(Protocol):
    cache: dict[str, str]

    def get(self, user_id: str) -> str: ...
```

## Preferred

```ts
interface UserStore {
  get(id: string): string;
}

class InMemoryUserStore implements UserStore {
  private readonly cache = new Map<string, string>();

  public get(id: string): string {
    const value = this.cache.get(id);
    if (value === undefined) {
      return '';
    }
    return value;
  }
}
```

```python
class UserStore(Protocol):
    def get(self, user_id: str) -> str: ...


class InMemoryUserStore:
    def __init__(self) -> None:
        self._cache: dict[str, str] = {}

    def get(self, user_id: str) -> str:
        return self._cache.get(user_id, '')
```
