export function EmptyState(): JSX.Element {
  return (
    <div className="empty-state" role="status">
      <p className="empty-title">Nothing to do yet</p>
      <p className="empty-hint">Add your first task above to get started.</p>
    </div>
  );
}
