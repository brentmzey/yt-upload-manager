import { describe, it, expect } from 'vitest';
import { Effect, Option } from 'effect';
import { enrichMetadata } from './enrichment';

describe('enrichMetadata', () => {
  it('replaces template variables in title and description', async () => {
    const metadata: any = {
      title: 'Video for {{channelName}}',
      description: 'Check out {{productLink}} for more info.',
      subDetails: {
        channelName: 'TechHub',
        productLink: 'https://example.com'
      },
      tags: [],
      privacyStatus: 'public',
      categoryId: '22'
    };

    const program = enrichMetadata(metadata);
    const result = await Effect.runPromise(program);

    expect(result.title).toBe('Video for TechHub');
    expect(result.description).toBe('Check out https://example.com for more info.');
  });

  it('leaves title and description unchanged if no templates match', async () => {
    const metadata: any = {
      title: 'Static Title',
      description: 'Static Description',
      subDetails: {
        foo: 'bar'
      },
      tags: [],
      privacyStatus: 'public',
      categoryId: '22'
    };

    const program = enrichMetadata(metadata);
    const result = await Effect.runPromise(program);

    expect(result.title).toBe('Static Title');
    expect(result.description).toBe('Static Description');
  });
});
