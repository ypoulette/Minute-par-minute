import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type OAuthCredential,
  type User,
} from 'firebase/auth';
import { Check, Eye, EyeOff, KeyRound, Mail, RefreshCw } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

function formatAuthError(err: unknown, context: 'google' | 'email' = 'email'): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Courriel ou mot de passe incorrect. Si ce compte utilise Google, cliquez sur « Continuer avec Google » ci-dessus (ou utilisez « Mot de passe oublié ? » pour lui associer un mot de passe).';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec ce courriel. Si vous vous êtes déjà connecté avec Google, utilisez « Continuer avec Google » ou cliquez sur « Mot de passe oublié ? » pour définir un mot de passe.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-email':
      return 'Adresse courriel invalide.';
    case 'auth/operation-not-allowed':
      return context === 'google'
        ? "La connexion Google est actuellement désactivée dans votre console Firebase (Authentication → Sign-in method → Google → Activer)."
        : "La connexion par courriel et mot de passe n'est pas encore activée dans votre console Firebase (Authentication → Sign-in method → E-mail/Mot de passe).";
    case 'auth/popup-blocked':
      return 'La fenêtre de connexion Google a été bloquée par votre navigateur. Autorisez les fenêtres contextuelles (popups) pour ce site et réessayez.';
    case 'auth/unauthorized-domain':
      return `Ce domaine (${window.location.hostname}) n’est pas autorisé dans votre console Firebase (Authentication → Settings → Authorized domains).`;
    case 'auth/user-disabled':
      return 'Ce compte utilisateur a été désactivé dans Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Erreur réseau lors de la connexion à Firebase. Vérifiez votre connexion Internet et réessayez.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Connexion Google annulée.';
    default: {
      const base =
        err instanceof Error ? err.message : 'Impossible de finaliser la connexion.';
      return code ? `${base} (${code})` : base;
    }
  }
}

interface AuthScreenProps {
  pendingVerificationUser?: User | null;
  onEmailVerified?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  pendingVerificationUser = null,
  onEmailVerified,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingGoogleCred, setPendingGoogleCred] = useState<OAuthCredential | null>(null);

  if (pendingVerificationUser) {
    const handleCheckVerified = async () => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await pendingVerificationUser.reload();
        if (pendingVerificationUser.emailVerified) {
          await pendingVerificationUser.getIdToken(true);
          onEmailVerified?.();
        } else {
          setError(
            'Votre adresse courriel ne semble pas encore confirmée. Cliquez sur le lien reçu dans votre boîte de réception (vérifiez aussi les courriels indésirables).'
          );
        }
      } catch (err) {
        setError(formatAuthError(err));
      } finally {
        setBusy(false);
      }
    };

    const handleResend = async () => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await sendEmailVerification(pendingVerificationUser);
        setNotice(
          `Un nouveau courriel de confirmation vient d'être envoyé à ${pendingVerificationUser.email}.`
        );
      } catch (err) {
        setError(formatAuthError(err));
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            ChronoPlan
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Vérification du compte
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                Confirmez votre adresse courriel
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Un lien de confirmation a été envoyé à{' '}
                <strong className="font-mono text-slate-900">
                  {pendingVerificationUser.email}
                </strong>
                . Cliquez sur ce lien pour sécuriser votre accès au planning partagé, puis
                revenez ici.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 leading-relaxed">
                {error}
              </p>
            )}

            {notice && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 leading-relaxed">
                {notice}
              </p>
            )}

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleCheckVerified}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {busy ? 'Vérification...' : 'J’ai confirmé mon courriel — Continuer'}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Renvoyer le courriel de confirmation
              </button>

              <button
                type="button"
                onClick={() => signOut(auth)}
                disabled={busy}
                className="w-full py-2 px-4 text-xs text-slate-500 hover:text-slate-800"
              >
                Utiliser un autre compte
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithPopup(auth, googleProvider);
      setPendingGoogleCred(null);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/account-exists-with-different-credential') {
        const pendingCred = GoogleAuthProvider.credentialFromError(err as never);
        const conflictEmail =
          typeof err === 'object' &&
          err !== null &&
          'customData' in err &&
          typeof (err as { customData?: { email?: unknown } }).customData?.email ===
            'string'
            ? (err as { customData: { email: string } }).customData.email
            : '';

        if (conflictEmail) setEmail(conflictEmail);
        setMode('signin');
        setPendingGoogleCred(pendingCred);
        setNotice(
          `Un compte par courriel et mot de passe existe déjà pour ${
            conflictEmail || 'cette adresse'
          }. Connectez-vous avec votre mot de passe ci-dessous pour associer automatiquement votre connexion Google (ou cliquez sur « Mot de passe oublié ? »).`
        );
      } else {
        setError(formatAuthError(err, 'google'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Veuillez saisir votre adresse courriel.');
      return;
    }

    if (mode === 'reset') {
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        setNotice(
          `Si un compte existe pour ${cleanEmail}, un lien de réinitialisation vient d’être envoyé.`
        );
      } catch (err) {
        setError(formatAuthError(err, 'email'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password) {
      setError('Veuillez saisir votre mot de passe.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // User still lands on verification screen where they can resend
        }
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (pendingGoogleCred) {
          try {
            await linkWithCredential(cred.user, pendingGoogleCred);
          } catch {
            // Sign-in succeeded; ignore linking conflict if already linked
          }
          setPendingGoogleCred(null);
        }
      }
    } catch (err) {
      setError(formatAuthError(err, 'email'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          ChronoPlan
        </span>
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          Planification d’événement collaborative
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900 text-balance">
              Planificateur minute par minute
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Connectez-vous avec votre compte Google ou par courriel et mot de passe pour
              consulter et modifier le déroulement avec votre équipe.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full py-2.5 px-4 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Continuer avec Google
          </button>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink-0 mx-3 text-xs text-slate-400">
              ou par courriel et mot de passe
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Mode tabs */}
          {mode !== 'reset' ? (
            <div className="flex items-center p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setNotice('');
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setNotice('');
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Créer un compte
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Réinitialiser le mot de passe</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setNotice('');
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Retour
              </button>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adresse courriel
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@exemple.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Mot de passe
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setError('');
                        setNotice('');
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'signup' ? 'Minimum 6 caractères' : '••••••••'
                    }
                    className="w-full pl-3 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 leading-relaxed">
                {error}
              </p>
            )}

            {notice && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 leading-relaxed">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {busy
                ? 'Traitement...'
                : mode === 'signup'
                ? 'Créer mon compte'
                : mode === 'reset'
                ? 'Envoyer le lien de réinitialisation'
                : 'Se connecter'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};