import '../tests/register-ts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {runSdxlQueue, SDXL_URL} = await import('../src/services/SdxlQueue.ts');
const blob = new Blob(['fixture'],{type:'image/png'});
function fake(events) {
  const state={closed:0,cancelled:0};
  const connect=async(url,options)=>{
    assert.equal(url,SDXL_URL);state.options=options;
    return {submit:(endpoint,payload)=>{state.endpoint=endpoint;state.payload=payload;return {async *[Symbol.asyncIterator](){yield* events;},async cancel(){state.cancelled++;}};},close(){state.closed++;}};
  };
  return {state,connect};
}
test('SDXL surfaces the real ZeroGPU error and disables persisted Gradio history',async()=>{
  const {state,connect}=fake([{type:'status',stage:'error',title:'ZeroGPU quota exceeded',message:'Authenticate with a Hugging Face token for more quota'}]);
  await assert.rejects(runSdxlQueue(blob,blob,'original prompt','negative',22,7,new AbortController().signal,undefined,undefined,connect),/cota gratuita.*Hugging Face/);
  assert.equal(state.options.record_history,false);assert.equal(state.closed,1);
});
test('SDXL forwards optional account token and returns the edited slider image',async()=>{
  const {state,connect}=fake([{type:'status',stage:'pending',position:1,eta:12},{type:'data',data:[[{path:'original.png'},{url:SDXL_URL+'/gradio_api/file=edited.webp'}]]}]);
  const progress=[];
  const url=await runSdxlQueue(blob,blob,'exact user prompt','negative',20,6,new AbortController().signal,'hf_fixture',message=>progress.push(message),connect);
  assert.equal(state.options.token,'hf_fixture');assert.equal(state.endpoint,'/predict');assert.equal(state.payload[1],'exact user prompt');assert.match(url,/edited.webp$/);assert.ok(progress.some(value=>value.includes('posição 2')));assert.equal(state.closed,1);
});
test('SDXL cancellation rejects promptly and closes a connection that resolves late',async()=>{
  let resolveConnection;let closed=0;
  const controller=new AbortController();
  const connect=()=>new Promise(resolve=>{resolveConnection=resolve;});
  const result=runSdxlQueue(blob,blob,'prompt','',20,7,controller.signal,undefined,undefined,connect);
  controller.abort(new Error('cancelado pelo usuário'));
  await assert.rejects(result,/cancelado pelo usuário/);
  resolveConnection({close(){closed++;}});await Promise.resolve();
  assert.equal(closed,1);
});
test('SDXL never sends a NVIDIA credential to Hugging Face',async()=>{
  let called=false;
  await assert.rejects(runSdxlQueue(blob,blob,'prompt','',20,7,new AbortController().signal,'nvapi_fixture',undefined,async()=>{called=true;}),/chave NVIDIA/);
  assert.equal(called,false);
});

test('cancelling an active job requests remote cancellation and closes the stream',async()=>{
  const controller=new AbortController();let started;const submitted=new Promise(resolve=>{started=resolve;});
  let closed=0,cancelled=0;
  const connect=async()=>({submit(){started();return {async *[Symbol.asyncIterator](){yield {type:'status',stage:'pending'};await new Promise(()=>{});},async cancel(){cancelled++;}};},close(){closed++;}});
  const result=runSdxlQueue(blob,blob,'prompt','',20,7,controller.signal,undefined,undefined,connect);
  await submitted;controller.abort(new Error('cancelado durante a fila'));
  await assert.rejects(result,/cancelado durante a fila/);
  assert.equal(cancelled,1);assert.equal(closed,1);
});

test('a stream that ends without an image reports failure instead of success',async()=>{
  const {state,connect}=fake([{type:'status',stage:'generating'}]);
  await assert.rejects(runSdxlQueue(blob,blob,'prompt','',20,7,new AbortController().signal,undefined,undefined,connect),/sem entregar uma imagem/);
  assert.equal(state.cancelled,1);assert.equal(state.closed,1);
});

test('already cancelled operations never connect or upload',async()=>{
  const controller=new AbortController();controller.abort(new Error('cancelado antes de enviar'));
  let called=false;
  await assert.rejects(runSdxlQueue(blob,blob,'prompt','',20,7,controller.signal,undefined,undefined,async()=>{called=true;}),/cancelado antes/);
  assert.equal(called,false);
});
