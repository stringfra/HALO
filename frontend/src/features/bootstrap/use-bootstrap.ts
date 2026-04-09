"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getBootstrapData, type BootstrapData } from "./api";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";

type BootstrapState = {
  data: BootstrapData | null;
  loading: boolean;
  error: string | null;
};

const initialState: BootstrapState = {
  data: null,
  loading: false,
  error: null,
};

export function useBootstrap(enabled = true) {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const [state, setState] = useState<Omit<BootstrapState, "loading">>({
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !session) {
      return;
    }

    let cancelled = false;

    void getBootstrapData()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setState({
          data,
          error: null,
        });
      })
      .catch((error: Error) => {
        if (cancelled) {
          return;
        }

        setState({
          data: null,
          error: error.message || "Errore caricando bootstrap tenant.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, session]);

  if (!enabled || !session) {
    return initialState;
  }

  return {
    ...state,
    loading: !state.data && !state.error,
  };
}
