import { Effect } from "effect";
import brotliPromise from "brotli-wasm";

export class CompressionError {
  readonly _tag = "CompressionError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

/**
 * Centralized list of domain fields that should be stored as compressed Brotli Base64.
 * Mapping: domain_field -> storage_field (ending in _brotli_b64)
 */
export const COMPRESSED_FIELDS_MAP = {
  description: "description_brotli_b64",
  subDetails: "subDetails_brotli_b64",
  localizations: "localizations_brotli_b64",
} as const;

export type CompressedField = keyof typeof COMPRESSED_FIELDS_MAP;

/**
 * Compresses a string using Brotli and encodes it to Base64.
 */
export const compressToBrotliB64 = (text: string): Effect.Effect<string, CompressionError> =>
  Effect.tryPromise({
    try: async () => {
      const brotli = await brotliPromise;
      const input = new TextEncoder().encode(text);
      const compressed = brotli.compress(input);
      // Convert Uint8Array to Base64
      return btoa(String.fromCharCode(...compressed));
    },
    catch: (error) => new CompressionError("Brotli compression failed", error),
  });

/**
 * Decodes a Base64 string and decompresses it using Brotli.
 */
export const decompressFromBrotliB64 = (b64: string): Effect.Effect<string, CompressionError> =>
  Effect.tryPromise({
    try: async () => {
      const brotli = await brotliPromise;
      // Convert Base64 to Uint8Array
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decompressed = brotli.decompress(bytes);
      return new TextDecoder().decode(decompressed);
    },
    catch: (error) => new CompressionError("Brotli decompression failed", error),
  });

/**
 * Helper to check if a field name indicates it is compressed.
 */
export const isCompressedField = (fieldName: string): boolean => 
  fieldName.endsWith("_brotli_b64");

/**
 * Helper to get the original field name from a compressed field name hint.
 */
export const getOriginalFieldName = (compressedName: string): string => 
  compressedName.replace("_brotli_b64", "");
