import { AppScreen } from '@/components/AppScreen';
import { EmptyState } from '@/components/EmptyState';

export function AdminPlaceholderScreen() {
  return (
    <AppScreen>
      <EmptyState title="Coming soon" message="This administration area is reserved for the next implementation step." />
    </AppScreen>
  );
}
