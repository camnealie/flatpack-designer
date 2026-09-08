import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({ label, id, className = '', ...props }: CheckboxProps) {
  const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={checkboxId}
        className={`h-4 w-4 rounded border-gray-300 text-blue-600
          focus:ring-2 focus:ring-blue-500 ${className}`}
        {...props}
      />
      <label htmlFor={checkboxId} className="text-sm text-gray-700">
        {label}
      </label>
    </div>
  );
}
