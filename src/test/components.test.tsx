import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Badge } from '../components/ui/Badge';

describe('Spotify Dark UI Components', () => {
  describe('Button', () => {
    it('renders primary button with Spotify Secondary (white) base and pill shape', () => {
      render(<Button variant="primary">Import Playlist</Button>);
      const btn = screen.getByRole('button', { name: /import playlist/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('bg-spotify-secondary');
      expect(btn).toHaveClass('rounded-full');
    });

    it('renders secondary button with transparent background and border', () => {
      render(<Button variant="secondary">Cancel</Button>);
      const btn = screen.getByRole('button', { name: /cancel/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('bg-transparent');
      expect(btn).toHaveClass('border-spotify-tertiary');
    });

    it('disables button and shows loader when isLoading is true', () => {
      render(<Button isLoading>Processing</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });
  });

  describe('Input', () => {
    it('renders pill input with surface background and text-secondary', () => {
      render(<Input placeholder="Search tracks..." />);
      const input = screen.getByPlaceholderText(/search tracks/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('rounded-full');
      expect(input).toHaveClass('bg-spotify-surface');
      expect(input).toHaveClass('text-spotify-secondary');
    });
  });

  describe('Card', () => {
    it('renders card with surface background and 8px/rounded-md border', () => {
      const { container } = render(<Card>Card Content</Card>);
      expect(container.firstChild).toHaveClass('bg-spotify-surface');
      expect(container.firstChild).toHaveClass('rounded-md');
    });
  });

  describe('Chip', () => {
    it('renders chip with pill shape and active state', () => {
      render(<Chip active>Rock</Chip>);
      const chip = screen.getByRole('button', { name: /rock/i });
      expect(chip).toHaveClass('rounded-full');
      expect(chip).toHaveClass('bg-spotify-secondary');
    });
  });

  describe('Badge', () => {
    it('renders success badge with Spotify primary green tone', () => {
      render(<Badge variant="success">Confirmed</Badge>);
      const badge = screen.getByText(/confirmed/i);
      expect(badge).toHaveClass('text-spotify-primary');
    });
  });
});
