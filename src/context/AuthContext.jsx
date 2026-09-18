import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, storage } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(storage.accessToken));

  const loadUser = useCallback(async () => {
    if (!storage.accessToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await api("/auth/me");
      setUser(data.user);
    } catch {
      storage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    storage.save(data);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = storage.refreshToken;
    try {
      if (refreshToken) {
        await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }, false);
      }
    } finally {
      storage.clear();
      setUser(null);
    }
  };

  const value = useMemo(() => ({ user, loading, login, logout, reloadUser: loadUser }), [user, loading, loadUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
