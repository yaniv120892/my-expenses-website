export function getStoredToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("authToken");
  }
  return null;
}

export function setStoredToken(token: string) {
  localStorage.setItem("authToken", token);
}

export function clearStoredToken() {
  localStorage.removeItem("authToken");
}

export function getStoredIsVerified() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("isVerified") === "true";
  }
  return false;
}

export function setStoredIsVerified(isVerified: boolean) {
  localStorage.setItem("isVerified", String(isVerified));
}

export function clearStoredIsVerified() {
  localStorage.removeItem("isVerified");
}

export function forceLogout() {
  clearStoredToken();
  clearStoredIsVerified();
  window.location.href = "/login";
}
