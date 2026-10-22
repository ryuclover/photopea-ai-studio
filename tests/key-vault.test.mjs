import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyVault } from '../src/services/KeyVault.ts';

test('temporary keys never write browser storage', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  KeyVault.setSessionKey('nvidia', 'test-session-key');
  assert.equal(KeyVault.getKey('nvidia'), 'test-session-key');
  assert.equal(storage.size, 0);
  KeyVault.removeKey('nvidia');
  assert.equal(KeyVault.getKey('nvidia'), null);
});

test('session mode works when an embedded browser blocks localStorage', () => {
  globalThis.localStorage = {
    getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceededError');},removeItem(){throw new Error('SecurityError');},
  };
  assert.equal(KeyVault.getKey('free_inpaint'),null);
  assert.equal(KeyVault.getCustomEndpoint('custom'),null);
  KeyVault.setSessionKey('free_inpaint','hf_fixture');
  assert.equal(KeyVault.getKey('free_inpaint'),'hf_fixture');
});

test('clearing a session credential does not revive an older persisted credential', () => {
  const storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  KeyVault.setKey('free_inpaint','hf_old');
  KeyVault.setSessionKey('free_inpaint','hf_new');
  KeyVault.setSessionKey('free_inpaint','');
  assert.equal(KeyVault.getKey('free_inpaint'),null);
});
