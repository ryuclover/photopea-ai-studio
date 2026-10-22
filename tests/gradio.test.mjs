import test from 'node:test';
import assert from 'node:assert/strict';
import { GradioEvents, resultURL } from '../src/services/GradioEvents.ts';

test('SSE survives every possible network split, heartbeats and CRLF', () => {
  const data = [[{url:'https://test.hf.space/original.png'}, {url:'https://test.hf.space/result.png'}]];
  const stream = `event: heartbeat\r\ndata: null\r\n\r\nevent: complete\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
  for (let i = 0; i <= stream.length; i++) {
    const parser = new GradioEvents();
    assert.deepEqual([...parser.push(stream.slice(0, i)), ...parser.push(stream.slice(i))], [data]);
  }
});

test('SSE errors report quota details', () => {
  assert.throws(() => new GradioEvents().push('event: error\ndata: GPU quota exceeded\n\n'), /quota exceeded/);
});

test('output selects the edited image, validates origin, and supports paths', () => {
  assert.equal(resultURL([[{url:'/original.png'}, {url:'/result.png'}]], 'https://test.hf.space'), 'https://test.hf.space/result.png');
  assert.equal(resultURL([[{}, {path:'/tmp/result.png'}]], 'https://test.hf.space'), 'https://test.hf.space/gradio_api/file=/tmp/result.png');
  assert.throws(() => resultURL([[{}, {url:'https://other.test/image.png'}]], 'https://test.hf.space'), /fora/);
  assert.throws(() => resultURL([], 'https://test.hf.space'), /não retornou/);
});
