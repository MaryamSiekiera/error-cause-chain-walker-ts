# error-cause-chain-walker-ts

Follows the ES2022 `cause` property through nested errors, collecting each message, name, and stack into an ordered array for top-level reporting.

## Usage

```js
import { walkChain } from 'error-cause-chain-walker-ts';

const root = new Error('top', {
  cause: new TypeError('middle', {
    cause: new RangeError('bottom'),
  }),
});

const nodes = walkChain(root);
// nodes[0] => { name: 'Error',      message: 'top',    stack: '...' }
// nodes[1] => { name: 'TypeError',  message: 'middle', stack: '...' }
// nodes[2] => { name: 'RangeError', message: 'bottom', stack: '...' }
```

`walkChain(error)` returns an array of `{ name: string, message: string, stack: string | null }`, one per node from the given error down to the last node that has an object-typed `cause`. Non-object input (other than `undefined`) yields a single node with empty name/message and `null` stack, so the caller never has to special-case the return type. `undefined` yields an empty array.

## Why this exists

When an operation catches and re-throws with `{ cause }`, the original failure is preserved but spread across linked objects. Logging libraries that only print the top-level `err.message` hide the real story. This walker flattens that link list into an array you can iterate, serialise, or render in one pass.

The trade-off: this is a **linked-list walker, not a graph visitor**. It follows `.cause` linearly and caps the walk at 100 nodes to break cycles. If your errors form a DAG you will only see one branch.

## Edge cases you will hit

- **Cyclic causes.** Nothing stops `a.cause = b; b.cause = a`. The walker caps at 100 nodes rather than tracking visited objects, because the chain is documented as a list and a depth guard is cheap and predictable.
- **Non-Error objects in the chain.** Real code sometimes throws plain objects. The walker collects any object with `name`/`message`/`stack` properties so you still see them in the report.
- **Missing `stack`.** V8 only sets `.stack` when `Error.captureStackTrace` runs. A bare `Object.create(Error.prototype)` has no own `stack`. Such nodes report `stack: null`, not `undefined`, so consumers can distinguish "no stack" from a stack string.
