'use client';

import { useState } from 'react';
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';

/**
 * Input component — label above, error below, password toggle.
 */
export default function Input({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  required = false,
  autoFocus = false,
  style,
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && (
        <label
          htmlFor={name}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--error)', marginLeft: '3px' }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={isPassword ? 'current-password' : undefined}
          style={{
            width: '100%',
            height: '40px',
            padding: '0 12px',
            paddingRight: isPassword ? '40px' : '12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-raised)',
            border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          onFocus={(e) => {
            if (!error) {
              e.target.style.borderColor = 'var(--accent)';
              e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)';
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? 'var(--error)' : 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--error)',
          }}
        >
          <WarningCircle size={14} weight="fill" />
          {error}
        </div>
      )}
    </div>
  );
}
