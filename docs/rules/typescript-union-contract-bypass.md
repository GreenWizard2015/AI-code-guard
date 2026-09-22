# `typescript-union-contract-bypass`

## Policy

Do not hide required contract data behind a union whose branches are a base type and an intersection of that same base type with additional fields.

## Why

This shape makes required metadata optional to callers while appearing to avoid nullable fields. It weakens the domain contract and bypasses the nullable-state policy.

## Fix

Define one explicit interface with all required fields, or use named state classes when the values represent different states.
