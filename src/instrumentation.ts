// Runs once when the server starts, so a bad environment fails fast.
export async function register() {
  await import("./env");
}
