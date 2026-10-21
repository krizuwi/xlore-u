import { KeyRound, Mail, MapPin, UserRound } from 'lucide-react';
import { AccountField } from './AccountField.jsx';
import { accountLimits } from '../lib/account-validation.js';
import '../institution/institution.css';

export function StudentRegistrationFields({ form, onChange }) {
  const field = (name, label, icon, limit, extra = {}) => <AccountField name={name} label={label} value={form[name]} onChange={onChange} icon={icon} limit={limit} required {...extra} />;
  return <>
    <section className="institution-registration-section">
      <h3><UserRound size={19} aria-hidden="true" /> Personal details</h3>
      <p>Tell us a little about yourself to set up your student profile.</p>
      <div className="institution-fields">
        {field('firstName', 'First name', UserRound, accountLimits.name, { autoComplete: 'given-name', placeholder: 'Your first name' })}
        {field('middleName', 'Middle name', UserRound, accountLimits.name, { required: false, autoComplete: 'additional-name', placeholder: 'Your middle name' })}
        {field('lastName', 'Last name', UserRound, accountLimits.name, { autoComplete: 'family-name', placeholder: 'Your last name' })}
        {field('address', 'Home address', MapPin, accountLimits.address, { className: 'wide', minLength: 5, autoComplete: 'street-address', placeholder: 'Street, barangay, city' })}
      </div>
    </section>
    <section className="institution-registration-section">
      <h3><KeyRound size={19} aria-hidden="true" /> Account details</h3>
      {field('email', 'Email address', Mail, accountLimits.email, { type: 'email', autoComplete: 'email', placeholder: 'student@example.com' })}
      {field('password', 'Password', KeyRound, undefined, { type: 'password', minLength: 8, autoComplete: 'new-password', placeholder: 'At least 8 characters', hint: 'Use at least 8 characters.' })}
      {field('confirmPassword', 'Re-enter password', KeyRound, undefined, { type: 'password', minLength: 8, autoComplete: 'new-password', placeholder: 'Repeat your password' })}
    </section>
  </>;
}
