import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {PhotopeaBridge} from '../src/core/PhotopeaBridge.ts';

function setup(onImport) {
  let listener;
  const events=[];
  const docs=[];
  const app={documents:docs,activeDocument:null,echoToOE(data){listener({source:target,origin:'https://www.photopea.com',data});}};
  function document(name,source='same-source') {
    const doc={name,source,width:64,height:64,layers:[{name:'original'}],selection:{},
      close(){events.push(['close',name]);docs.splice(docs.indexOf(doc),1);},
    };
    Object.defineProperty(doc,'activeLayer',{get(){return doc.layers[0];},set(value){doc.layers[0]=value;}});
    doc.layers[0].duplicate=(destination)=>{events.push(['duplicate',name,destination.name]);destination.layers.unshift({name:doc.layers[0].name});};
    docs.push(doc);return doc;
  }
  const target={postMessage(script){queueMicrotask(()=>{
    if(script instanceof ArrayBuffer) onImport?.({app,docs,document,events});
    else runInNewContext(script,{app,ElementPlacement:{PLACEATBEGINNING:1},SaveOptions:{DONOTSAVECHANGES:1}});
    app.echoToOE('done');
  });}};
  globalThis.window={parent:target,self:{},top:{},setTimeout,clearTimeout,addEventListener(_,fn){listener=fn;}};
  globalThis.document={referrer:''};
  const bridge=PhotopeaBridge.forEmbeddedPhotopea(target);
  return {bridge,app,docs,document,events};
}

test('document identity distinguishes two open files with identical source values',async()=>{
  const env=setup();const a=env.document('A'),b=env.document('B');
  env.app.activeDocument=a;const first=await env.bridge.getDocumentInfo();
  env.app.activeDocument=b;const second=await env.bridge.getDocumentInfo();
  assert.notEqual(first.id,second.id);assert.notEqual(first.source,second.source);
  await assert.rejects(env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edit',first.id),/Volte ao documento/);
  assert.deepEqual(env.events,[]);
});

test('insertion finds the actual new import even when it is not the last or active document',async()=>{
  const env=setup(({app,docs,document})=>{
    const imported=document('import');docs.splice(docs.indexOf(imported),1);docs.unshift(imported);
    app.activeDocument=docs.at(-1);
  });
  const destination=env.document('target'),other=env.document('unrelated');env.app.activeDocument=destination;
  const info=await env.bridge.getDocumentInfo();
  assert.equal(await env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edited',info.id),true);
  assert.deepEqual(env.events,[['duplicate','import','target'],['close','import']]);
  assert.equal(destination.layers[0].name,'edited');assert.ok(env.docs.includes(other));
});

test('closing the destination during import never redirects the result into another document',async()=>{
  const env=setup(({app,document})=>{app.activeDocument.close();app.activeDocument=document('import');});
  const destination=env.document('target');const other=env.document('unrelated');env.app.activeDocument=destination;
  const info=await env.bridge.getDocumentInfo();
  await assert.rejects(env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edited',info.id),/destino foi fechado/);
  assert.equal(other.layers.length,1);assert.deepEqual(env.events,[['close','target']]);
  assert.ok(env.docs.some(doc=>doc.name==='import'));
});

test('an additional document opened during import aborts without closing either new document',async()=>{
  const env=setup(({app,document})=>{document('unexpected');app.activeDocument=document('import');});
  env.app.activeDocument=env.document('target');const info=await env.bridge.getDocumentInfo();
  await assert.rejects(env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edited',info.id),/com segurança/);
  assert.deepEqual(env.events,[]);assert.equal(env.docs.length,3);
});

test('an import that creates no new document never duplicates or closes an existing file',async()=>{
  const env=setup();env.app.activeDocument=env.document('target');env.document('unrelated');const info=await env.bridge.getDocumentInfo();
  await assert.rejects(env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edited',info.id),/com segurança/);
  assert.deepEqual(env.events,[]);assert.equal(env.docs.length,2);
});

test('text generation without an open document opens a new document',async()=>{
  const env=setup(({app,document})=>{app.activeDocument=document('generated');});
  assert.equal(await env.bridge.insertImageAsLayer(new ArrayBuffer(1)),true);
  assert.equal(env.docs.length,1);assert.equal(env.docs[0].name,'generated');
});

test('resizing a captured document blocks insertion before importing a patch',async()=>{
  const env=setup();env.app.activeDocument=env.document('target');const info=await env.bridge.getDocumentInfo();
  env.app.activeDocument.width=128;
  await assert.rejects(env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edit',info.id,{width:64,height:64}),/tamanho do documento mudou/);
  assert.deepEqual(env.events,[]);assert.equal(env.docs.length,1);
});

test('resizing the destination during import blocks duplication and preserves the import',async()=>{
  const env=setup(({app,document})=>{app.activeDocument.width=128;app.activeDocument=document('import');});
  env.app.activeDocument=env.document('target');const info=await env.bridge.getDocumentInfo();
  await assert.rejects(env.bridge.insertImageAsLayer(new ArrayBuffer(1),'edit',info.id,{width:64,height:64}),/tamanho do documento mudou/);
  assert.deepEqual(env.events,[]);assert.equal(env.docs.length,2);
});
