import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('WMS-lite')).toBeInTheDocument();
  });

  it('renders the building message', () => {
    render(<App />);
    expect(screen.getByText(/正在建设中/)).toBeInTheDocument();
  });
});
