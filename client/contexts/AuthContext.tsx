import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import {
  AccountUser,
  loadStoredAuth,
  signInWithAppleToken,
  signInWithGoogleToken,
  fetchMe,
  clearStoredAuth,
} from "@/services/authService";
import { getDeviceId } from "@/services/portfolioService";
import {
  configurePurchases,
  linkPurchasesUser,
  logoutPurchases,
  isProActive,
} from "@/services/purchasesService";
import { queryClient } from "@/lib/query-client";
import { PORTFOLIO_KEY } from "@/hooks/usePortfolio";

interface AuthContextValue {
  ready: boolean;
  user: AccountUser | null;
  isSignedIn: boolean;
  isPro: boolean;
  appleAvailable: boolean;
  signInWithApple: () => Promise<void>;
  completeGoogleSignIn: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setProLocally: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // After ownership changes (sign-in / out / claim), the cloud-scoped vault is
  // different — drop the cached query so it refetches under the new owner.
  const invalidateVault = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PORTFOLIO_KEY });
  }, []);

  // Boot: restore session, configure RevenueCat, refresh entitlement.
  useEffect(() => {
    (async () => {
      const { user: stored } = await loadStoredAuth();
      setUser(stored);
      setIsPro(stored?.isPro ?? false);

      await configurePurchases(stored?.id);

      if (Platform.OS === "ios") {
        AppleAuthentication.isAvailableAsync()
          .then(setAppleAvailable)
          .catch(() => setAppleAvailable(false));
      }

      // Reconcile Pro from server (authoritative) + RevenueCat (immediate).
      const [fresh, rcPro] = await Promise.all([fetchMe(), isProActive()]);
      if (fresh) setUser(fresh);
      setIsPro((fresh?.isPro ?? stored?.isPro ?? false) || rcPro);

      setReady(true);
    })();
  }, []);

  const signInWithApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error("No Apple identity token");

    const displayName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(" ") || undefined
      : undefined;

    const deviceId = await getDeviceId();
    const { user: signedIn } = await signInWithAppleToken({
      idToken: credential.identityToken,
      displayName,
      deviceId,
    });

    setUser(signedIn);
    setIsPro(signedIn.isPro);
    await linkPurchasesUser(signedIn.id);
    invalidateVault();
    // Pull authoritative Pro after RevenueCat user is linked.
    void refresh();
  }, [invalidateVault]);

  const completeGoogleSignIn = useCallback(
    async (idToken: string) => {
      const deviceId = await getDeviceId();
      const { user: signedIn } = await signInWithGoogleToken({ idToken, deviceId });
      setUser(signedIn);
      setIsPro(signedIn.isPro);
      await linkPurchasesUser(signedIn.id);
      invalidateVault();
      void refresh();
    },
    [invalidateVault],
  );

  const signOut = useCallback(async () => {
    await clearStoredAuth();
    await logoutPurchases();
    setUser(null);
    setIsPro(false);
    invalidateVault();
  }, [invalidateVault]);

  const refresh = useCallback(async () => {
    const [fresh, rcPro] = await Promise.all([fetchMe(), isProActive()]);
    if (fresh) setUser(fresh);
    setIsPro((fresh?.isPro ?? false) || rcPro);
  }, []);

  const setProLocally = useCallback((value: boolean) => setIsPro(value), []);

  return (
    <AuthContext.Provider
      value={{
        ready,
        user,
        isSignedIn: !!user,
        isPro,
        appleAvailable,
        signInWithApple,
        completeGoogleSignIn,
        signOut,
        refresh,
        setProLocally,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
