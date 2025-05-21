import api from "./api";
import { UserSettings } from "../types";

export async function getUserSettings(): Promise<UserSettings> {
  const res = await api.get("/api/user/settings");
  return res.data;
}

export async function updateUserSettings(
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  const res = await api.put("/api/user/settings", settings);
  return res.data;
}
