type ErrorDetails = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

function detailsOf(error: unknown): ErrorDetails {
  if (typeof error !== "object" || error === null) return {};
  return error as ErrorDetails;
}

/** Maps service errors to a sentence a member can act on without exposing backend details. */
export function userSafeError(error: unknown, fallback = "That didn’t work. Please try again."): string {
  const { code, message, name, status } = detailsOf(error);
  const errorCode = typeof code === "string" ? code : "";
  const errorStatus = typeof status === "number"
    ? status
    : typeof status === "string" && status.trim()
      ? Number(status)
      : Number.NaN;
  const internalMessage = typeof message === "string" ? message : "";

  if (name === "AbortError") return "That took too long. Check your connection and try again.";
  if (/failed to fetch|network error|fetch failed/i.test(internalMessage)) {
    return "FrameDecks couldn’t reach the service. Check your connection and try again.";
  }

  switch (errorCode) {
    case "23505":
      return "That already exists. Choose a different name.";
    case "23503":
      return "This is still in use, so it can’t be changed yet.";
    case "23514":
      return "Check the details and try again.";
    case "42501":
    case "PGRST301":
      return "You don’t have permission to make that change. Ask a workspace owner.";
    case "53400":
      return "Too many changes just now. Wait a moment, then try again.";
    case "PGRST116":
      return "That item is no longer available. Refresh and try again.";
    case "invalid_credentials":
      return "Those sign-in details couldn’t be verified. Check them and try again.";
  }

  if (errorStatus === 401) return "Your sign-in has expired. Sign in again and retry.";
  if (errorStatus === 403) return "You don’t have permission to make that change. Ask a workspace owner.";
  if (errorStatus === 429) return "Too many attempts just now. Wait a moment, then try again.";
  if (errorStatus >= 500) return "The service is having trouble. Please try again shortly.";

  return fallback;
}
