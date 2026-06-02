const BADGE_STYLES = {
  success:  { bg: 'var(--success-bg)', color: 'var(--success)', border: 'rgba(34,197,94,0.2)' },
  warning:  { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'rgba(245,158,11,0.2)' },
  error:    { bg: 'var(--error-bg)',   color: 'var(--error)',   border: 'rgba(239,68,68,0.2)' },
  info:     { bg: 'var(--info-bg)',    color: 'var(--info)',    border: 'rgba(79,142,247,0.2)' },
  neutral:  { bg: 'var(--bg-raised)', color: 'var(--text-secondary)', border: 'var(--border)' },
};

/**
 * Badge — status labels.
 * @param {'success'|'warning'|'error'|'info'|'neutral'} variant
 */
export default function Badge({ children, variant = 'neutral', style }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '22px',
        padding: '0 8px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        borderRadius: 'var(--radius-full)',
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
