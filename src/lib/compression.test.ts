import { describe, it, expect, vi } from 'vitest';
import { Effect } from 'effect';
import { compressToBrotliB64, decompressFromBrotliB64 } from './compression';

vi.mock('brotli-wasm', () => {
  return {
    default: Promise.resolve({
      compress: (input: Uint8Array) => input, // Passthrough mock
      decompress: (input: Uint8Array) => input, // Passthrough mock
    }),
  };
});

describe('Compression', () => {
  it('should compress and decompress strings correctly', async () => {
    const originalText = "This is a test string that should be compressed and then decompressed back to its original state.";
    
    const program = compressToBrotliB64(originalText).pipe(
      Effect.flatMap(compressed => decompressFromBrotliB64(compressed))
    );

    const result = await Effect.runPromise(program);
    expect(result).toBe(originalText);
  });

  it('should handle empty strings', async () => {
    const originalText = "";
    
    const program = compressToBrotliB64(originalText).pipe(
      Effect.flatMap(compressed => decompressFromBrotliB64(compressed))
    );

    const result = await Effect.runPromise(program);
    expect(result).toBe(originalText);
  });
});
