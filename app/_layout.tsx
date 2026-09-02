import { useCallback, useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold_Italic,
} from '@expo-google-fonts/playfair-display';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getOwnProfile, isProfileComplete } from '@/lib/profile';
import { ProfileRefreshContext } from '@/lib/profile-context';
import {
  computeRedirect,
  type AuthSegment,
  type KycEstado,
  type ProfileStatus,
} from '@/lib/route-guard';

const AUTH_SEGMENTS: AuthSegment[] = [
  'sign-in',
  'verify-otp',
  'select-role',
  'profile-setup',
  'kyc',
];

export default function RootLayout() {
  // Solo los pesos que el design system usa — no las familias completas: buena
  // parte del publico objetivo esta en Android de gama media.
  const [fontsLoaded, fontError] = useFonts({
    'PlayfairDisplay-Italic': PlayfairDisplay_400Regular_Italic,
    'PlayfairDisplay-Italic-SemiBold': PlayfairDisplay_600SemiBold_Italic,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });
  const router = useRouter();
  const segments = useSegments();
  const { session, loading: sessionLoading } = useAuthSession();

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('none');
  const [kycEstado, setKycEstado] = useState<KycEstado>('pendiente');
  const [profileLoading, setProfileLoading] = useState(Boolean(session));
  // Reset profile state synchronously during render when the session identity
  // changes, instead of setState-in-effect (see React docs: "Resetting state
  // when a prop changes").
  const [trackedSession, setTrackedSession] = useState<Session | null>(session);
  if (trackedSession !== session) {
    setTrackedSession(session);
    setProfileStatus('none');
    setKycEstado('pendiente');
    setProfileLoading(Boolean(session));
  }

  // Aplica una fila de profiles al estado del guardián. Extraída para no
  // duplicar el cálculo entre la carga inicial y `refreshProfile` — pero
  // sin hacer la petición ella misma, para que el efecto de abajo pueda
  // seguir con su `.then()` inline (el patrón que ya pasaba el lint) en vez
  // de una llamada síncrona a una función que hace setState internamente.
  const aplicarPerfil = useCallback((profile: Awaited<ReturnType<typeof getOwnProfile>>) => {
    setProfileStatus(
      profile === null ? 'none' : isProfileComplete(profile) ? 'complete' : 'incomplete',
    );
    setKycEstado(profile?.kyc_estado ?? 'pendiente');
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    getOwnProfile().then((profile) => {
      if (!mounted) return;
      aplicarPerfil(profile);
    });
    return () => {
      mounted = false;
    };
  }, [session, aplicarPerfil]);

  // Lo que las pantallas piden tras escribir el perfil (Task 1, bloque 2b):
  // `_layout` solo relee en el efecto de arriba, atado a `[session]`, que
  // no cambia al terminar el alta ni al verificar KYC.
  //
  // Devuelve la promesa — la pantalla que llama la espera antes de navegar,
  // si no, `router.replace` dispara el efecto de redirección con el
  // `profileStatus` todavía viejo (carrera detectada en revisión del
  // bloque 2b: navegar sin esperar rebotaba al usuario al paso 1 igual que
  // el bug original, solo que un instante después).
  //
  // Sin guarda de `mounted` en `aplicarPerfil` en este camino: se dispara
  // desde una pantalla que está por desmontarse (va a navegar apenas
  // resuelva), no compite con un cambio de sesión concurrente como sí le
  // pasa al efecto de arriba. Un setState tras desmontar es inocuo en
  // React 18 — no "arreglar" esto agregando una guarda que no hace falta.
  const refreshProfile = useCallback(() => {
    return getOwnProfile().then(aplicarPerfil);
  }, [aplicarPerfil]);

  const currentSegment = segments[segments.length - 1];
  const authSegment: AuthSegment = AUTH_SEGMENTS.includes(currentSegment as AuthSegment)
    ? (currentSegment as AuthSegment)
    : null;

  useEffect(() => {
    // `fontError` cuenta como "resuelto": si una fuente no carga, la app sigue
    // con el tipo del sistema en vez de quedarse en blanco para siempre.
    if (sessionLoading || profileLoading || (!fontsLoaded && !fontError)) return;
    const redirect = computeRedirect({
      hasSession: Boolean(session),
      profileStatus,
      kycEstado,
      authSegment,
    });
    if (redirect) {
      router.replace(redirect as never);
    }
  }, [
    sessionLoading,
    profileLoading,
    session,
    profileStatus,
    kycEstado,
    authSegment,
    router,
    fontsLoaded,
    fontError,
  ]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </ProfileRefreshContext.Provider>
  );
}
