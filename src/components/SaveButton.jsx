import { Heart } from 'lucide-react';

export function SaveButton({ saved = false, onClick, disabled = false, label }) {
  return <button type="button" className={`save-btn${saved ? ' saved' : ''}`} onClick={onClick} disabled={disabled}
    aria-label={label} title={label} aria-pressed={saved}>
    <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
  </button>;
}
