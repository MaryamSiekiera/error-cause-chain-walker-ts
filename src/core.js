/**
 * Core logic for walking an ES2022 error's `.cause` chain.
 *
 * ES2022 introduced the `cause` property on `Error` so that a re-thrown
 * error can retain a reference to the underlying failure. This module
 * follows that chain and collects a flat, ordered snapshot of each node
 * so callers can log the entire story in one place.
 */

/**
 * A single node in the error chain, as observed by the walker.
 *
 * `message`, `name`, and `stack` are copied by value at collection time so
 * that later mutations to the original Error objects do not retroactively
 * change a report that was already built.
 *
 * `stack` is intentionally typed as `string | null` rather than `string | undefined`
 * because, at runtime, V8 only sets `.stack` when `Error.captureStackTrace` is
 * invoked (or the constructor runs). A bare object like `Object.create(Error.prototype)`
 * has no own `stack` property at all. We normalise that absence to `null` so
 * downstream consumers can treat it as "no stack available" without tripping
 * over `undefined`-versus-`null` distinctions.
 *
 * @typedef {Object} ChainNode
 * @property {string} name   - The `Error.prototype.name` value (e.g. "TypeError", "Error").
 * @property {string} message - The `.message` string.
 * @property {string | null} stack - The `.stack` string if present, otherwise `null`.
 */

/**
 * Read a string property defensively, returning `''` for non-strings.
 *
 * Why not just `String(err.name)`: because `String(undefined)` is the literal
 * text `"undefined"`, which is indistinguishable from an error whose name was
 * genuinely the string `"undefined"`. Returning `''` for the absent case keeps
 * the empty value obvious in reports.
 *
 * @param {unknown} value
 * @returns {string}
 */
function readString(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Read the `stack` property, normalising absent values to `null`.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function readStack(value) {
  return typeof value === 'string' ? value : null;
}

/**
 * Maximum chain depth to prevent runaway walks on cyclic `.cause` graphs.
 *
 * ES2022 `cause` is not required to be an Error and nothing stops a caller
 * from writing `a.cause = a`. A depth guard is simpler and more predictable
 * than a visited-set: the chain is documented as a linked list, not a graph,
 * and depth is cheap to reason about.
 */
const MAX_DEPTH = 100;

/**
 * Walk the `.cause` chain of a starting Error and return an ordered array of
 * nodes, root error first.
 *
 * The first element is always the provided `error`. Each subsequent element is
 * the `cause` of the previous one, until a non-Object `cause`, an absent
 * `cause`, or the depth limit is reached. Non-Error objects are still
 * collected if they appear in the chain, because real-world libraries
 * sometimes throw plain objects and the cause link is the only signal that
 * they are part of the failure story.
 *
 * @param {unknown} error - The error to start from. If not an object, a single
 *   node with an empty name/message and `null` stack is returned so the caller
 *   never has to special-case the return value.
 * @returns {ChainNode[]}
 */
export function walkChain(error) {
  const nodes = [];
  let current = error;
  let depth = 0;

  while (current !== null && typeof current === 'object') {
    if (depth >= MAX_DEPTH) {
      break;
    }
    nodes.push({
      name: readString(current.name),
      message: readString(current.message),
      stack: readStack(current.stack),
    });
    current = current.cause;
    depth += 1;
  }

  return nodes;
}
