import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Faengt Render-Fehler ab, damit ein einzelner Fehler nicht die ganze App
 * durch eine weisse Seite ersetzt. React bietet dafuer bis heute nur eine
 * Klassenkomponente an - es gibt kein Hook-Aequivalent.
 */

type Props = {
  children: ReactNode;
  /** Wechselt dieser Wert, wird der Fehler zurueckgesetzt (z.B. bei Routenwechsel) */
  resetKey?: string;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unbehandelter Render-Fehler:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // Nach einem Seitenwechsel nicht am alten Fehler haengen bleiben
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-semibold">Diese Ansicht konnte nicht geladen werden</h2>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Deine Daten sind nicht betroffen — es ist nur die Anzeige gescheitert.
            Lade die Seite neu; tritt der Fehler erneut auf, hilft die Meldung unten
            bei der Ursachensuche.
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
            {error.message}
          </pre>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-white transition hover:bg-brand-dark"
          >
            <RotateCw size={16} />
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }
}
