import { Link } from 'react-router-dom';

export function AccountAgreement({ checked, onChange, disabled, id = 'account-agreement', institution = false }) {
  return <div className="account-agreement">
    <label htmlFor={id} className="checkbox-row">
      <input id={id} name="acceptedPolicies" type="checkbox" required checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} />
      <span>I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link> and acknowledge that I have read the <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</span>
    </label>
    <p>The policies open in a new tab, so your form stays here. {institution ? 'Submit only public school information and evidence you are authorized to share.' : 'Optional home-location sharing is a separate choice in Profile.'}</p>
  </div>;
}
