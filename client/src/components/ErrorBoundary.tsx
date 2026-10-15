import { Component } from "react";
import type { ReactNode } from "react";
import ErrorBoundaryMessage from "./ErrorBoundaryMessage";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryMessage />;
    }
    return this.props.children;
  }
}
