# `typescript-instanceof`

Validate values at a boundary and avoid scattering repeated `instanceof` checks through business logic.

Use one `typeof` check at the external input boundary instead. Return the explicit
domain type from that boundary and do not repeat runtime checks in business logic.
