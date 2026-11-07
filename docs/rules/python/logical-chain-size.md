# `logical-chain-size`

Description: Logical conditions with more than three parts or at least 100 significant characters are difficult to name,
review, and reuse. The rule counts the operands in a connected TypeScript `&&`, `||`, or `??`
expression and Python `and` or `or` expression. A single operand is ignored because it is not a
logical chain. Significant characters are counted with the same whitespace-insensitive metric used by callable-size checks. Mixed nested logical operators are counted as one chain, and only the outer
expression is reported.


### Fix

Extract the condition into a named boolean variable or a predicate method, then use that
name at the decision or return boundary.


```python
can_publish = has_name and has_type and is_active and is_visible
return can_publish
```

## Bad


```python
# File: src/entry_policy.py
class EntryPolicy:
    """Responsibilities: _entry permission decisions_."""

    def __init__(self, identity: str, ticket: str, payment: str, term: str) -> None:
        """Responsibilities: _policy initialization_."""
        self._identity: str = identity
        self._ticket: str = ticket
        self._payment: str = payment
        self._term: str = term

    def entry_permitted(self) -> bool:
        """Responsibilities: _entry permission evaluation_."""
        return (
            len(self._identity.strip()) > 0
            and len(self._ticket.strip()) > 0
            and self._payment == "paid"
            and self._term == "current"
        )  # <- error

    def status_label(self) -> str:
        """Responsibilities: _entry status formatting_."""
        return f"Entry permitted: {self.entry_permitted()}"

    def report(self) -> None:
        """Responsibilities: _entry status output_."""
        print(self.status_label())
# File: cli.py
from src.entry_policy import EntryPolicy

if __name__ == "__main__":
    policy = EntryPolicy("Ada", "ticket-7", "paid", "current")
    policy.report()
```

## Good


```python
# File: src/entry_policy.py
class EntryPolicy:
    """Responsibilities: _entry permission decisions_."""

    def __init__(self, identity: str, ticket: str, payment: str, term: str) -> None:
        """Responsibilities: _policy initialization_."""
        self._identity: str = identity
        self._ticket: str = ticket
        self._payment: str = payment
        self._term: str = term

    def identity_valid(self) -> bool:
        """Responsibilities: _identity validation_."""
        return len(self._identity.strip()) > 0

    def booking_valid(self) -> bool:
        """Responsibilities: _booking validation_."""
        ticket_valid = len(self._ticket.strip()) > 0
        payment_valid = self._payment == "paid" and self._term == "current"
        return ticket_valid and payment_valid

    def entry_permitted(self) -> bool:
        """Responsibilities: _entry permission evaluation_."""
        identity_valid = self.identity_valid()
        booking_valid = self.booking_valid()
        return identity_valid and booking_valid

    def status_label(self) -> str:
        """Responsibilities: _entry status formatting_."""
        return f"Entry permitted: {self.entry_permitted()}"

    def report(self) -> None:
        """Responsibilities: _entry status output_."""
        print(self.status_label())
# File: cli.py
from src.entry_policy import EntryPolicy

if __name__ == "__main__":
    policy = EntryPolicy("Ada", "ticket-7", "paid", "current")
    policy.report()
```
