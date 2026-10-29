import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkChain } from '../src/core.js';

// Helper: build a chain of real Error objects linked by `cause`.
function buildChain(messages) {
  let cause = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const err = new Error(messages[i]);
    if (cause) err.cause = cause;
    cause = err;
  }
  return cause;
}

test('returns a single node when there is no cause', () => {
  const err = new Error('solo');
  const nodes = walkChain(err);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].message, 'solo');
  assert.equal(nodes[0].name, 'Error');
  assert.equal(typeof nodes[0].stack, 'string');
});

test('walks a three-deep cause chain in order', () => {
  const root = buildChain(['top', 'middle', 'bottom']);
  const nodes = walkChain(root);
  assert.equal(nodes.length, 3);
  assert.deepEqual(
    nodes.map((n) => n.message),
    ['top', 'middle', 'bottom'],
  );
});

test('preserves the name of each error in the chain', () => {
  const bottom = new TypeError('bad arg');
  const top = new Error('wrapped', { cause: bottom });
  const nodes = walkChain(top);
  assert.deepEqual(
    nodes.map((n) => n.name),
    ['Error', 'TypeError'],
  );
});

test('returns an empty array when passed a non-object', () => {
  const nodes = walkChain('not an error');
  assert.equal(nodes.length, 0);
});

test('returns an empty array when passed null', () => {
  const nodes = walkChain(null);
  assert.equal(nodes.length, 0);
});

test('returns an empty array when passed undefined', () => {
  const nodes = walkChain(undefined);
  assert.equal(nodes.length, 0);
});

test('stops at a non-object cause', () => {
  const top = new Error('top');
  top.cause = 'a string is not an object';
  const nodes = walkChain(top);
  assert.equal(nodes.length, 1);
});

test('walks plain objects that carry a message', () => {
  const top = new Error('top');
  const plain = { message: 'plain cause', name: 'PlainObject' };
  top.cause = plain;
  const nodes = walkChain(top);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[1].message, 'plain cause');
  assert.equal(nodes[1].name, 'PlainObject');
  assert.equal(nodes[1].stack, null);
});

test('breaks on a cyclic cause graph without looping forever', () => {
  const a = new Error('a');
  const b = new Error('b');
  a.cause = b;
  b.cause = a; // cycle
  const nodes = walkChain(a);
  // The depth guard caps the walk at 100 nodes.
  assert.equal(nodes.length, 100);
});

test('returns an empty array when the first error is a number', () => {
  const nodes = walkChain(42);
  assert.equal(nodes.length, 0);
});

test('does not include the cause property itself in collected nodes', () => {
  const bottom = new Error('bottom');
  const top = new Error('top', { cause: bottom });
  const nodes = walkChain(top);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].message, 'top');
  assert.equal(nodes[1].message, 'bottom');
});

test('captures stack when present and null when absent on a bare object', () => {
  const top = new Error('top');
  const bare = Object.create(Error.prototype);
  bare.message = 'bare';
  bare.name = 'BareError';
  top.cause = bare;
  const nodes = walkChain(top);
  assert.equal(nodes.length, 2);
  assert.equal(typeof nodes[0].stack, 'string');
  assert.equal(nodes[1].stack, null);
});
