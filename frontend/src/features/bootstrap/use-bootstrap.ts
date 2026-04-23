"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<Omit<BootstrapState, "loading">>({
    data: null,
    error: null,
  });

  const refresh = useCallback(() => {
    setReloadVersion((previous) => previous + 1);
  }, []);

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
  }, [enabled, reloadVersion, session]);

  if (!enabled || !session) {
    return {
      ...initialState,
      refresh,
    };
  }

  return {
    ...state,
    loading: !state.data && !state.error,
    refresh,
  };
}
