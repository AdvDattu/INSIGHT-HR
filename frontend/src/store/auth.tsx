import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { storage } from "@/src/utils/storage";
import { ERPNextCredentials, Employee } from "@/src/types/erpnext";

const CREDS_KEY = "ess.erpnext.credentials";
const EMPLOYEE_KEY = "ess.erpnext.employee";

type AuthState = {
  loading: boolean;
  credentials: ERPNextCredentials | null;
  employee: Employee | null;
};

type AuthContextType = AuthState & {
  signIn: (creds: ERPNextCredentials, employee: Employee) => Promise<void>;
  signOut: () => Promise<void>;
  setEmployee: (e: Employee) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    credentials: null,
    employee: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const credsRaw = await storage.secureGet(CREDS_KEY, "");
        const empRaw = await storage.getItem(EMPLOYEE_KEY, "");
        const credentials =
          credsRaw && typeof credsRaw === "string" && credsRaw.length
            ? (JSON.parse(credsRaw) as ERPNextCredentials)
            : null;
        const employee =
          empRaw && typeof empRaw === "string" && empRaw.length
            ? (JSON.parse(empRaw) as Employee)
            : null;
        setState({ loading: false, credentials, employee });
      } catch {
        setState({ loading: false, credentials: null, employee: null });
      }
    })();
  }, []);

  const signIn = useCallback(
    async (creds: ERPNextCredentials, employee: Employee) => {
      await storage.secureSet(CREDS_KEY, JSON.stringify(creds));
      await storage.setItem(EMPLOYEE_KEY, JSON.stringify(employee));
      setState({ loading: false, credentials: creds, employee });
    },
    [],
  );

  const signOut = useCallback(async () => {
    await storage.secureRemove(CREDS_KEY);
    await storage.removeItem(EMPLOYEE_KEY);
    setState({ loading: false, credentials: null, employee: null });
  }, []);

  const setEmployee = useCallback(async (e: Employee) => {
    await storage.setItem(EMPLOYEE_KEY, JSON.stringify(e));
    setState((s) => ({ ...s, employee: e }));
  }, []);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, setEmployee }),
    [state, signIn, signOut, setEmployee],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
