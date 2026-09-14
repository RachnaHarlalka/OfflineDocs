export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in. Nothing was changed.",
  provider_error: "Google rejected the sign-in request. Please try again.",
  invalid_oauth_state:
    "That sign-in attempt expired or could not be verified. Please start again.",
  provider_not_configured:
    "Google sign-in is not configured on this server yet.",
  oauth_exchange_failed:
    "We could not finish the exchange with Google. Please try again.",
  oauth_profile_failed:
    "We could not read your Google profile. Please try again.",
  email_not_verified:
    "Your Google email address is not verified. Verify it with Google, then sign in again.",
  email_already_registered:
    "Another DocSync account already uses this email address.",
  login_failed: "Something went wrong signing you in. Please try again.",
};

export const FALLBACK_AUTH_ERROR = AUTH_ERROR_MESSAGES.login_failed;

export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_AUTH_ERROR;
}

/** Codes the API returns in a JSON body rather than a redirect. */
export const API_ERROR_CODES = {
  /** The access token aged out — refresh once and retry, do not send the user to login. */
  tokenExpired: "token_expired",
  unauthorized: "unauthorized",
  csrfInvalid: "csrf_token_invalid",
  refreshReused: "refresh_token_reused",
  refreshExpired: "refresh_token_expired",
} as const;

export const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

export const DOC_ERROR_MESSAGES: Record<string, string> = {
  not_found: "This document is no longer available. Try refreshing the list.",
  forbidden: "You do not have access to do that.",
  bad_request: "That title isn't valid. Please enter a non-empty title.",
  invite_user_not_found: "No DocSync account uses that email address.",
  already_collaborator: "This person already has access to this document.",
  last_owner: "This document needs at least one owner.",
};

export const FALLBACK_DOC_ERROR = "Something went wrong. Please try again.";

export function docErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return DOC_ERROR_MESSAGES[code] ?? FALLBACK_DOC_ERROR;
}
