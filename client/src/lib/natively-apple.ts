// Build Natively bridge — NativelyAppleSignInService is injected at runtime
// by the iOS native wrapper. Does not exist on plain web/desktop.

export interface NativelyAppleSignInResp {
  status: boolean;
  subject?: string;    // stable unique ID: iCloud account scoped to this app
  email?: string;      // only present on the very first sign-in
  givenname?: string;
  familyname?: string;
  initial?: boolean;   // true = user's first-ever sign-in to this app
  message?: string;    // present when status = false
}

/** Returns true only inside the Build Natively iOS wrapper. */
export function isAppleSignInAvailable(): boolean {
  try {
    // @ts-ignore — NativelyAppleSignInService injected by Build Natively wrapper
    return typeof NativelyAppleSignInService !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Triggers the Apple Sign In sheet.
 * Calls onSuccess with the response if the user approves,
 * or onError with a message string on failure/cancellation.
 */
export function triggerAppleSignIn(
  onSuccess: (resp: NativelyAppleSignInResp) => void,
  onError: (msg: string) => void,
): void {
  try {
    // @ts-ignore — NativelyAppleSignInService injected by Build Natively wrapper
    const svc = new NativelyAppleSignInService();
    svc.signin((resp: NativelyAppleSignInResp) => {
      if (resp.status) {
        onSuccess(resp);
      } else {
        onError(resp.message ?? "Apple sign-in failed");
      }
    });
  } catch {
    onError("Apple sign-in is not available on this device.");
  }
}
