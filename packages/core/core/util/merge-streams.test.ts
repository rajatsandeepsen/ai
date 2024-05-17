import { expect, it } from 'vitest';
import { mergeStreams } from './merge-streams';
import { convertReadableStreamToArray } from '../test/convert-readable-stream-to-array';
import { convertArrayToReadableStream } from '../test/convert-array-to-readable-stream';

it('should prioritize the first stream over the second stream', async () => {
  const stream1 = convertArrayToReadableStream(['1a', '1b', '1c']);
  const stream2 = convertArrayToReadableStream(['2a', '2b', '2c']);

  const mergedStream = mergeStreams(stream1, stream2);

  expect(await convertReadableStreamToArray(mergedStream)).toEqual([
    '1a',
    '1b',
    '1c',
    '2a',
    '2b',
    '2c',
  ]);
});

it('should return values from the 2nd stream until the 1st stream has values', async () => {
  let stream1Controller: ReadableStreamDefaultController<string> | undefined;
  const stream1 = new ReadableStream({
    start(controller) {
      stream1Controller = controller;
    },
  });

  let stream2Controller: ReadableStreamDefaultController<string> | undefined;
  const stream2 = new ReadableStream({
    start(controller) {
      stream2Controller = controller;
    },
  });

  const mergedStream = mergeStreams(stream1, stream2);

  const result: string[] = [];
  const reader = mergedStream.getReader();

  async function pull() {
    const { value, done } = await reader.read();
    result.push(value!);
  }

  stream2Controller!.enqueue('2a');
  stream2Controller!.enqueue('2b');

  await pull();
  await pull();

  stream2Controller!.enqueue('2c');
  stream2Controller!.enqueue('2d'); // comes later
  stream1Controller!.enqueue('1a');
  stream2Controller!.enqueue('2e'); // comes later
  stream1Controller!.enqueue('1b');
  stream1Controller!.enqueue('1c');
  stream2Controller!.enqueue('2f');

  await pull();
  await pull();
  await pull();
  await pull();
  await pull();

  stream1Controller!.close();
  stream2Controller!.close();

  await pull();
  await pull();

  expect(result).toEqual([
    '2a',
    '2b',
    '2c',
    '1a',
    '1b',
    '1c',
    '2d',
    '2e',
    '2f',
  ]);
});
