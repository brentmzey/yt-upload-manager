import { Effect } from 'effect';
import { VideoMetadataSchema } from '../channel/config';

export const enrichMetadata = (
  metadata: typeof VideoMetadataSchema.Type
) =>
  Effect.sync(() => {
    const template = (str: string) => {
      let result = str;
      for (const [key, value] of Object.entries(metadata.subDetails)) {
        // Use split/join to avoid regex injection since we are doing literal replacement
        result = result.split(`{{${key}}}`).join(value);
      }
      return result;
    };

    return {
      ...metadata,
      title: template(metadata.title),
      description: template(metadata.description),
    };
  });
