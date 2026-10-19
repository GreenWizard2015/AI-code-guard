# `temporary-result-access`

Description: Assign copied arrays and objects created with spread before
accessing their members. Named field and method access on ordinary function
results is allowed.

## Bad

```ts
return new Reader().read();
return new Reader().payload;
return resolve(input)[key];
void [...rule_ids].sort();
void ({ ...rule_options }).mode;
```


**Fix:** Assign constructed objects, indexed call results, and spread copies to
named variables before using them. Ordinary array and object literals are
permitted.

## Good

```ts
// File: cli.ts
#!/usr/bin/env node
(function () {
	const response = resolve(input);
	const payload = response.payload;
	const rendered = resolve(input).render();
	const copied_rule_ids = [...rule_ids];
	copied_rule_ids.sort();
	const option_snapshot = { ...rule_options };
	console.log(payload, rendered, copied_rule_ids, option_snapshot.mode);
})();
```

