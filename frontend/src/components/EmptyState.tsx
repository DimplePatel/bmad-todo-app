export function EmptyState(): JSX.Element {
  return (
    <div className="empty-state" role="status" data-testid="empty-state">
      <p className="empty-title">Nothing to do yet</p>
      <p className="empty-hint">Add your first task above to get started.</p>
    </div>
  );
}
