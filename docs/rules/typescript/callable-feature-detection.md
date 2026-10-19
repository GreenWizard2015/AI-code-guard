# `callable-feature-detection`

Description: Do not check whether an operation on a project-owned contract is callable and then
choose a fallback. Declare the operation on the contract and call it directly.

## Bad

```ts
#!/usr/bin/env node
(function () {
	if (typeof client.run === "function") { client.run(); }
})();
```

## Good

```ts
#!/usr/bin/env node
(function () {
	client.run();
})();
```
