# `private-member`

Description: Access private state through a public operation on its owning class.

## Bad

```ts
class AccountState {
	private balance: number = 0;
}

const account = new AccountState();
account.balance;
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
