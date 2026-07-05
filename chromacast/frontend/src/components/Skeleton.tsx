export default function Skeleton() {
  return (
    <div className="skeleton-layout">
      <div className="skeleton-cover skeleton-pulse" />
      <div className="skeleton-right">
        <div className="skeleton-line skeleton-pulse" style={{ width: "70%", height: "1.5rem" }} />
        <div className="skeleton-line skeleton-pulse" style={{ width: "50%", height: "0.875rem" }} />
        <div className="skeleton-bar skeleton-pulse" />
        <div className="skeleton-controls skeleton-pulse" />
      </div>
    </div>
  );
}
