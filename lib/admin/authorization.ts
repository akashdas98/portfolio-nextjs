const fallbackAdminEmails = ["akash42662012@gmail.com"];

export function getAdminEmails() {
  const configuredEmails = process.env.ADMIN_EMAILS;
  const source = configuredEmails?.trim() ? configuredEmails : fallbackAdminEmails.join(",");

  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
