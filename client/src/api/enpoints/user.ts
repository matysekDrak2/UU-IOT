import { api } from "../client";
import type { TokenResponse, User } from "../types";

export function registerUser(payload: {
  username: string;
  email: string;
  password: string;
}) {
  return api<User>("/user", { method: "PUT", body: payload });
}

export function loginUser(payload: { email: string; password: string }) {
  return api<TokenResponse>("/user", { method: "POST", body: payload });
}

export function getMe() {
  return api<{ id: string; username: string; email: string }>("/user", { method: "GET" });
}
