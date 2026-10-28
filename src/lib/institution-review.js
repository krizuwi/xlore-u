export function institutionApprovalRequirements(application, verifiedAuthority, note) {
  return [
    { key: 'email', complete: application.emailVerified === true, label: application.emailVerified ? 'Representative contact email verified' : 'Representative must verify their contact email' },
    { key: 'authority', complete: verifiedAuthority === true, label: verifiedAuthority ? 'School representation independently verified' : 'Check the independent authority verification box' },
    { key: 'reason', complete: Boolean(note.trim()), label: note.trim() ? 'Review reason entered' : 'Enter a review reason / instructions' }
  ];
}
