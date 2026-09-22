# `singular-plural-alias`

**Purpose:** A pair such as `base_class_name?: T` and `base_class_names?: T[]` can encode one
alias relationship through two optional representations.

**Fix:** Check the alias resolution boundary and keep one explicit representation, or resolve the
defining type before storing both fields.
