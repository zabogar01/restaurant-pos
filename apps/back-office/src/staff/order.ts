import type { UserView } from '@pos/contracts';

// How BO-06 draws the people it holds. The model holds them in the order the server answered
// (creation order, ties by identity); the table groups them for display only: active first,
// inactive second, each group keeping that order. A state change therefore keeps a person's
// creation position and moves them between the groups. The client never sorts by name.

export function inOrder(users: readonly UserView[]): UserView[] {
  return [...users.filter((u) => u.isActive), ...users.filter((u) => !u.isActive)];
}

export function countsOf(users: readonly UserView[]): { active: number; inactive: number } {
  const active = users.filter((u) => u.isActive).length;
  return { active, inactive: users.length - active };
}

/** A person is a former manager when a retained username survives a move out of MANAGER. */
export const isFormerManager = (user: UserView): boolean => user.classification !== 'MANAGER' && user.username !== null;
