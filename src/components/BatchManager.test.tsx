import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchManager } from './BatchManager';
import { YouTubeServiceLive } from '../lib/youtube/service';
import { LoggerServiceLive } from '../lib/logger';

describe('BatchManager', () => {
  it('renders the dropzone', () => {
    render(<BatchManager />);
    expect(screen.getByText(/Click or drag videos to stage/i)).toBeInTheDocument();
  });

  it('stages files when selected via input', () => {
    const { container } = render(<BatchManager />);
    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = container.querySelector('input[type="file"]')!;
    
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('test-video')).toBeInTheDocument();
    expect(screen.getByText(/Total/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Count of staged videos
  });
});
