/** The key a wait is held under: DESIGN-015 compares trimmed, lower-case usernames. */
export const accountKey = (username: string): string => username.trim().toLowerCase();
