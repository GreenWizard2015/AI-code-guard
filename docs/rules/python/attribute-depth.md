# `attribute-depth`

Description: Deep object graphs couple callers to implementation details.


## Bad


```python
class Profile:
	def user_id(self, request: Request) -> str:
		return request.session.user.profile.identifier
```

**Fix:** Add a named operation or narrow boundary; do not hide the chain in temporary variables.

```python
request.session.user.profile.identifier
```

## Good


```python
from typing import Protocol

class UserIdentityContract(Protocol):
	"""Responsibilities: _user identity boundary_."""

	def user_id(self) -> str: ...

	def display_name(self) -> str: ...

	def contact_address(self) -> str: ...

	def active(self) -> bool: ...
```
