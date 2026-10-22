import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { PhotopeaBridge } from '../src/core/PhotopeaBridge.ts';

let listener;
const sent = [];
globalThis.window = {
  self: {}, top: {},
  parent: { postMessage: (data, origin) => sent.push({data, origin}) },
  addEventListener: (_, handler) => { listener = handler; },
  setTimeout, clearTimeout,
};
globalThis.document = {referrer:''};
const message = data => listener({source:window.parent, origin:'https://www.photopea.com', data});
const acknowledge = () => message(sent.at(-1).data.match(/app.echoToOE\("(__AI_STUDIO_[^"]+)"\);$/)[1]);

test('bridge rejects spoofed responses and serializes binary imports with scripts', async () => {
  const bridge = PhotopeaBridge.getInstance();
  assert.equal(bridge.isConnectedToPhotopea(), false);
  assert.equal(bridge.isEmbedded(), true);
  const first = bridge.runScript('first');
  const buffer = new ArrayBuffer(8);
  const second = bridge.runScript(buffer);
  assert.equal(sent.length, 1);
  listener({source: {}, origin:'https://www.photopea.com', data:'done'});
  listener({source: window.parent, origin:'https://evil.test', data:'done'});
  assert.equal(sent.length, 1);
  message('done'); // Extra initialization "done" must not complete this command.
  assert.equal(sent.length, 1);
  message('answer'); acknowledge(); message('done');
  assert.equal(await first, 'answer');
  assert.equal(bridge.isConnectedToPhotopea(), true);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].data, buffer);
  assert.equal(sent[1].origin, 'https://www.photopea.com');
  message('done');
  await second;
});

test('script errors reject instead of reporting success, and the queue remains usable', async () => {
  const bridge = PhotopeaBridge.getInstance();
  const failed = bridge.runScript('throw new Error("falha real");');
  runInNewContext(sent.at(-1).data, {app:{echoToOE:message}, Error});
  message('done');
  await assert.rejects(failed, /falha real/);
  const success = bridge.runScript('app.echoToOE("recuperado");');
  runInNewContext(sent.at(-1).data, {app:{echoToOE:message}});
  message('done');
  assert.equal(await success, 'recuperado');
});

test('mask export restores layer visibility and active layer when export fails', async () => {
  const bridge = PhotopeaBridge.getInstance();
  const original = {visible:true};
  const hidden = {visible:false};
  const document = {
    layers:[original, hidden], activeLayer:original,
    selection:{bounds:[1,2,3,4],fill(){}},
    artLayers:{add(){const layer={visible:true,remove(){document.layers.pop();}};document.layers.push(layer);document.activeLayer=layer;return layer;}},
    saveToOE(){throw new Error('falha na exportação');},
  };
  const result = bridge.exportSelectionMask();
  runInNewContext(sent.at(-1).data, {
    app:{activeDocument:document,documents:[document],echoToOE:message},
    SolidColor:function(){this.rgb={};},
  });
  message('done');
  await assert.rejects(result, /falha na exportação/);
  assert.equal(document.layers.length, 2);
  assert.equal(original.visible, true);
  assert.equal(hidden.visible, false);
  assert.equal(document.activeLayer, original);
});

test('timeout rejects the entire queue and ignores late responses', async () => {
  const bridge = PhotopeaBridge.getInstance();
  const realTimeout = window.setTimeout;
  let triggerTimeout;
  window.setTimeout = callback => { triggerTimeout = callback; return 0; };
  const first = bridge.runScript('slow');
  const second = bridge.runScript('queued');
  triggerTimeout();
  await assert.rejects(first, /não respondeu/);
  await assert.rejects(second, /não respondeu/);
  message('done');
  await assert.rejects(bridge.runScript('retry'), /Reabra/);
  window.setTimeout = realTimeout;
});
