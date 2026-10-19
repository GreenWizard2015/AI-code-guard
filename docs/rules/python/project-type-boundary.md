# `project-type-boundary`

Description: Public callable parameters and results must expose a Protocol, interface, or focused
value contract instead of a project implementation class.


The rule resolves project type aliases and generic containers. Protocols, interfaces, and named
type contracts remain valid boundary types.


Fix: Depend on a narrow Protocol or interface and keep concrete classes behind that boundary.

## Bad


```python
class User: pass
class UserStore:
    def save(self, user: User) -> User: return user
```

## Good


```python
class ReaderContract(Protocol):
    def content_text(self) -> str: ...
```
