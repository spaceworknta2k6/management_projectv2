/**
 * Spinner — loading indicator.
 * @param {'sm'|'md'|'lg'} size
 */
export default function Spinner({ size = 'md', color, style }) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 32 : 22;

  return (
    <span
      role="status"
      aria-label="Đang tải..."
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        border: `2px solid var(--border-light)`,
        borderTopColor: color || 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        ...style,
      }}
    />
  );
}
