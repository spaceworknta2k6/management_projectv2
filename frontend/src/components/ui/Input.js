'use client';

import { useState } from 'react';
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import css from './Input.module.css';

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
  className = '',
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const rootClass = [css.root, className].filter(Boolean).join(' ');
  const inputClass = [
    css.input,
    isPassword ? css.passwordInput : '',
    error ? css.inputError : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {label && (
        <label
          htmlFor={name} className={css.s1} >
          {label}
          {required && <span className={css.s2}>*</span>}
        </label>
      )}

      <div className={css.s3}>
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
          aria-required={required || undefined}
          className={inputClass}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className={css.s5}
          >
            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <div className={css.s4} >
          <WarningCircle size={14} weight="fill" />
          {error}
        </div>
      )}
    </div>
  );
}
