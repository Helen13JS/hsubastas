import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { createAuthService, authErrorMessage } from "../modules/auth/authService.js";
import { hasSupabaseConfig } from "../js/supabaseClient.js";
const AuthContext = createContext(null);
const service = createAuthService();
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig());
  const [error, setError] = useState("");
  const revision = useRef(0), alive = useRef(true);
  async function refresh(next) {
    const current = ++revision.current;
    setSession(next);
    setProfile(null);
    setError("");
    try {
      const result = next ? await service.getProfile(next.user.id) : null;
      if (alive.current && current === revision.current) setProfile(result);
    } catch (failure) {
      if (alive.current && current === revision.current) setError(authErrorMessage(failure));
    } finally {
      if (alive.current && current === revision.current) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    let stop = () => {
    };
    if (hasSupabaseConfig()) void service.subscribe((_event, next) => {
      setTimeout(() => {
        if (alive.current) void refresh(next);
      }, 0);
    }).then((cleanup) => {
      if (alive.current) stop = cleanup;
      else cleanup();
    }).catch((failure) => {
      if (alive.current) {
        setError(authErrorMessage(failure));
        setLoading(false);
      }
    });
    return () => {
      alive.current = false;
      revision.current++;
      stop();
    };
  }, []);
  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    error,
    service,
    refresh,
    async signOut() {
      await service.signOut();
      await refresh(null);
    }
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
function useAuth() {
  return useContext(AuthContext);
}
export {
  AuthContext,
  AuthProvider,
  useAuth
};
