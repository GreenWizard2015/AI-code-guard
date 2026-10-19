# `attribute-depth`

Description: Deep object graphs couple callers to implementation details.

```ts
request.session.user.profile.id
```

## Bad

```ts
class Profile {
	public user_id(request: Request): string {
		return request.session.user.profile.identifier;
	}
}
```


**Fix:** Add a named operation or narrow boundary; do not hide the chain in temporary variables.


## Good

```ts
/** Responsibilities: _user identity boundary_. **/
export interface UserIdentityContract {
	/** Read the stable identity used by callers. */
	user_id(): string;

	/** Read the display label without exposing profile storage. */
	display_name(): string;

	/** Read the contact address without exposing the user graph. */
	contact_address(): string;

	/** Read the account state through a domain operation. */
	active(): boolean;
}
```

