import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { identityInputProps } from '../lib/identity-validation.js';

// Shared by student and institution registration so labels, counters and inputs stay aligned.
export function AccountField({ label, value = '', onChange, icon: Icon, type = 'text', limit, required = false, multiline = false, hint, className = '', ...props }) {
  const id = useId(), [visible, setVisible] = useState(false), password = type === 'password';
  const helpId = id + '-help';
  const identityProps = identityInputProps(props.name, type);
  const help = [hint, identityProps.title].filter(Boolean).join(' ');
  return <label className={'institution-auth-field ' + className} htmlFor={id}>
    <span id={id + '-label'}>{label}{!required && <small> (optional)</small>}</span>
    {multiline ? <textarea id={id} value={value} onChange={onChange} required={required} maxLength={limit} aria-labelledby={id + '-label'} aria-describedby={helpId} {...props} />
      : <div className={'input-with-icon' + (!Icon ? ' no-field-icon' : '')}>
        {Icon && <Icon size={18} aria-hidden="true" />}<input id={id} value={value} onChange={onChange} required={required} type={password && visible ? 'text' : type} maxLength={type === 'number' ? undefined : limit} aria-labelledby={id + '-label'} aria-describedby={help || limit ? helpId : undefined} {...identityProps} {...props} />
        {password && <button type="button" className="input-icon-btn" aria-label={visible ? 'Hide ' + label.toLowerCase() : 'Show ' + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </div>}
    {(help || limit) && <small id={helpId} className="institution-field-help">{help && <span>{help}</span>}{limit && <span className="institution-character-count">{password ? `Up to ${limit} characters` : `${value.length} / ${limit}`}</span>}</small>}
  </label>;
}
