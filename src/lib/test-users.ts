// Test users on the live site are named "zz-test-…": they're left out of every
// count (welcome page, group screen, popular picks, roommate lists, exports).
export const TEST_PREFIX = "zz-test-";

export const isTestName = (name: string) => name.trim().toLowerCase().startsWith(TEST_PREFIX);
