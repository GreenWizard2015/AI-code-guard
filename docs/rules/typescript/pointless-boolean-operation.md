# pointless-boolean-operation

Description: Reports a boolean identity comparison whose only body action is returning.
The syntax differs by language, but the hack is the same: a direct boolean
value is hidden behind a branch that adds no behavior.

## Bad


```ts
// File: cli.ts
function is_ready(value: boolean): boolean {
    if (value === true) {
        return true;
    }
    return false;
}
(function () { const result = is_ready(true); })();
```

## Good


```ts
// File: cli.ts
function is_ready(value: boolean): boolean {
    return value;
}
(function () { const result = is_ready(true); })();
```
