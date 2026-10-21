// UI visibility only. Every mutation is independently scoped by the API.
// Bind cached ownership to both the signed-in user and the current school.
export function canManageSchool(user, record, schoolId) {
  return Boolean(user?.role === 'institution' && user.emailVerified && record?.userId === user.id &&
    record.data?.canEdit === true && record.data.application?.status === 'approved' && record.data.school?.id === schoolId);
}
