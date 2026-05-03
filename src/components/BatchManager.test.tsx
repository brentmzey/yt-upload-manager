import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchManager } from './BatchManager';
import { YouTubeServiceLive } from '../lib/youtube/service';
import { LoggerServiceLive } from '../lib/logger';
import { Effect, Layer } from 'effect';

// Mock the whole pocketbase library to avoid constructor issues
vi.mock('pocketbase', () => {
  return {
    default: class {
      collection = () => ({
        authWithPassword: () => Promise.resolve(),
        getFullList: () => Promise.resolve([]),
        getFirstListItem: () => Promise.resolve({ id: 'batch-1' }),
        create: () => Promise.resolve({ id: 'record-1' }),
        update: () => Promise.resolve({ id: 'record-1' }),
        delete: () => Promise.resolve(true),
      });
      authStore = { isValid: false, save: () => {} };
    }
  };
});

// Mock the pocketbase service module
vi.mock('../lib/pocketbase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pocketbase')>();
  const { Effect, Layer, Context } = await import('effect');
  
  const MockLayer = Layer.succeed(
    actual.PocketBaseService,
    {
      getChannels: () => Effect.succeed([]),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({ id: 'batch-1' }),
      createBatch: () => Effect.succeed({ id: 'batch-1' }),
      getStagedVideos: () => Effect.succeed([]),
      saveStagedVideo: (v: any) => Effect.succeed({ id: v.id || 'new-id' }),
      deleteStagedVideo: () => Effect.void,
    }
  );

  return {
    ...actual,
    PocketBaseServiceLive: MockLayer,
  };
});

describe('BatchManager', () => {
  it('renders the dropzone', () => {
    render(<BatchManager />);
    expect(screen.getByText(/Click or drag videos to stage/i)).toBeInTheDocument();
  });

  it('stages files and allows editing metadata', async () => {
    const { container } = render(<BatchManager />);
    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = container.querySelector('input[type="file"]')!;
    
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('test-video')).toBeInTheDocument();
    
    // Open editor
    const editBtn = screen.getByTitle('Edit Metadata');
    fireEvent.click(editBtn);

    // Change title
    const titleInput = screen.getByLabelText(/Video Title/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    // Verify change in list (the list item should update)
    expect(screen.getByText('Updated Title')).toBeInTheDocument();

    // Close editor
    fireEvent.click(screen.getByText(/Done Editing/i));
    expect(screen.queryByLabelText(/Video Title/i)).not.toBeInTheDocument();
  });

  it('allows reordering tasks using move buttons', () => {
    const { container } = render(<BatchManager />);
    const file1 = new File(['1'], 'v1.mp4', { type: 'video/mp4' });
    const file2 = new File(['2'], 'v2.mp4', { type: 'video/mp4' });
    const input = container.querySelector('input[type="file"]')!;
    
    fireEvent.change(input, { target: { files: [file1, file2] } });

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]).toHaveTextContent('v1');
    expect(rows[1]).toHaveTextContent('v2'); 

    // Move v2 up
    const moveUpBtns = screen.getAllByTitle('Move Up');
    fireEvent.click(moveUpBtns[1]); // Button for second task

    const newRows = container.querySelectorAll('tbody tr');
    expect(newRows[0]).toHaveTextContent('v2');
    expect(newRows[1]).toHaveTextContent('v1');
  });
});
