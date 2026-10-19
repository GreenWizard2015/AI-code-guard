# Interface And Protocol Fields

Description: See the examples below for the rule behavior.

### Purpose

Interfaces define behavior boundaries. Mutable fields put state in the contract and force
every implementation to share representation. Immutable `readonly` value snapshots are allowed.

### Preferred

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


## Bad

```ts
interface UserStore {
  cache: Map<string, string>;
  get(id: string): string;
}
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _content access contract_. **/
export interface ReaderContract {
	/** Responsibilities: _content consumption_. **/
	consume_content(): string;
}
```

