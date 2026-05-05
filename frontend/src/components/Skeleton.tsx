export function Skeleton(): JSX.Element {
  return (
    <ul className="todo-list" aria-busy="true" aria-label="Loading todos">
      {[0, 1, 2].map((i) => (
        <li key={i} className="todo-item skeleton-row" aria-hidden="true">
          <span className="skeleton-bar" />
        </li>
      ))}
    </ul>
  );
}
