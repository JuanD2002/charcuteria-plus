import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const enforceActive = async (sess: Session | null) => {
      if (!sess?.user) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      // Defer DB call to avoid recursion in onAuthStateChange
      setTimeout(async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("user_id", sess.user.id)
          .maybeSingle();
        if (error || !data || data.is_active === false) {
          toast.error("Tu cuenta está deshabilitada. Contacta al administrador.");
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        setSession(sess);
        setUser(sess.user);
        setLoading(false);
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void enforceActive(newSession);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      void enforceActive(existing);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
