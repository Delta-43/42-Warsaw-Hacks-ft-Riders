// A synthetic bootstrap-seed user (source_status: 'seed' in the live cache
// DB, not a real student) that leaks into logtime/project-pass endpoints.
// Filtered out of every people-facing list. Real accounts with "test" in the
// login (staff/pisciner test accounts on the actual 42 platform, e.g.
// stouftestwarsaw, mtest) are NOT in this set and must stay visible.
export const KNOWN_TEST_USER_IDS = new Set<number>([1001])

export function isKnownTestUser(userId: number): boolean {
  return KNOWN_TEST_USER_IDS.has(userId)
}
