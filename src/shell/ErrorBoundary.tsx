import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-red-700">
              Something went wrong
            </h2>
            <pre className="mb-4 overflow-auto rounded bg-red-50 p-3 text-sm text-red-600">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
