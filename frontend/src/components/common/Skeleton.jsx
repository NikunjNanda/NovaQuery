import React from 'react';

/**
 * Loading Skeleton component with subtle dark shimmer.
 * 
 * @param {Object} props
 * @param {string} [props.className=''] - Dimensions and positioning classes
 */
export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-slate-800/40 rounded-lg border border-slate-800/60 ${className}`}
    />
  );
}
