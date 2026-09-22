export const JEST_EXPECT = 'expect';
export const JEST_ANY = 'any';
export const JEST_ANY_VALUES = new Set(['any', 'anything']);
export const JEST_SHAPES = new Set(['toEqual', 'toStrictEqual']);
export const JEST_PROPERTY = 'toHaveProperty';
export const JEST_DEFINED = 'toBeDefined';
export const JEST_EXCEPTIONS = new Set([
	'toThrow',
	'toThrowError',
	'toThrowErrorMatchingSnapshot',
	'toThrowErrorMatchingInlineSnapshot',
]);
export const JEST_INSTANCE = 'toBeInstanceOf';
export const JEST_OBJECT = 'objectContaining';
