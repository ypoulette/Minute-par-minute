import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Une erreur inattendue est survenue.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Accès refusé ou erreur Firestore (${parsed.operationType} sur ${parsed.path}) : ${parsed.error}`;
        }
      } catch {
        // Keep raw message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="text-lg font-semibold text-slate-900">
              Impossible de charger les données
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed break-words">
              {friendly}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Recharger l’application
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut(auth);
                  } finally {
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}