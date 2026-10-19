# `setattr`

Description: Dynamic assignment hides which state changes.


The equivalent TypeScript dynamic assignment is also rejected:

```ts
setattr(item, 'name', value);
```


Fix: Assign an explicit field or use a named state-transition method.

## Bad

```ts
setattr(item, "name", value);
```


## Good

```ts
// File: cli.ts
(function () {
	item.name = value;
})();
```
