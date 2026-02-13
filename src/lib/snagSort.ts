import { Snag } from '../types';

const parseCreatedAt = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sortSnagsByCreatedAtDesc = (snags: Snag[]): Snag[] =>
  [...snags].sort((a, b) => {
    const aTime = parseCreatedAt(a.created_at);
    const bTime = parseCreatedAt(b.created_at);
    if (aTime !== bTime) return bTime - aTime;
    return a.id.localeCompare(b.id);
  });
