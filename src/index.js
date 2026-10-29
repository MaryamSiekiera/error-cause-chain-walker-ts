/**
 * Public entry point for error-cause-chain-walker-ts.
 *
 * Re-exports `walkChain` from the core module so consumers import from a
 * single path: `error-cause-chain-walker-ts`.
 */
export { walkChain } from './core.js';
