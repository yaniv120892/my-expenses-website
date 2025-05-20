import { ApiResponse } from "../types";

function isApiResponseError(obj: unknown): obj is ApiResponse<unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "success" in obj &&
    "error" in obj
  );
}

export function handleApiError(error: unknown): string {
  if (isApiResponseError(error)) {
    return error.error || "An unknown error occurred";
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return "An unknown error occurred";
  }
}
