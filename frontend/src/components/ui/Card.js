/**
 * Card — surface container with optional header.
 */
export default function Card({ children, title, subtitle, actions, noPadding = false, style }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : '20px' }}>{children}</div>
    </div>
  );
}
