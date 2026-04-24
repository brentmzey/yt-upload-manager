import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LogConsole } from './LogConsole';
import { uiLogListeners } from '../lib/logger';

describe('LogConsole', () => {
  beforeEach(() => {
    uiLogListeners.clear();
  });

  it('renders and displays logs', () => {
    render(<LogConsole />);
    
    expect(screen.getByText(/Waiting for activity/i)).toBeInTheDocument();

    act(() => {
      uiLogListeners.forEach(l => l({
        level: 'info',
        message: 'Hello World',
        timestamp: Date.now()
      }));
    });

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for activity/i)).not.toBeInTheDocument();
  });

  it('clears logs when trash icon is clicked', () => {
    render(<LogConsole />);
    
    act(() => {
      uiLogListeners.forEach(l => l({
        level: 'info',
        message: 'Persistent Log',
        timestamp: Date.now()
      }));
    });

    const clearButton = screen.getByTitle('Clear logs');
    fireEvent.click(clearButton);

    expect(screen.queryByText('Persistent Log')).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for activity/i)).toBeInTheDocument();
  });

  it('toggles visibility', () => {
    render(<LogConsole />);
    
    // Initial state is open
    expect(screen.getByText(/User Feedback & Activity Logs/i)).toBeInTheDocument();

    // Close it
    const closeButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('.lucide-chevron-down');
    fireEvent.click(closeButton!.parentElement!);

    expect(screen.queryByText(/User Feedback & Activity Logs/i)).not.toBeInTheDocument();

    // Re-open via terminal button
    const openButton = screen.getByRole('button');
    fireEvent.click(openButton);

    expect(screen.getByText(/User Feedback & Activity Logs/i)).toBeInTheDocument();
  });
});
