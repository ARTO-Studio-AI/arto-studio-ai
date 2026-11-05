"use client";

import { useSyncExternalStore } from "react";

/* Preferencia booleana de este navegador (por ejemplo, barra lateral contraida). Vive en
 * localStorage; si falla (modo privado, almacenamiento bloqueado) se recuerda solo en memoria.
 * La comparten la barra lateral de usuario (AppSidebar) y la del admin (AdminNav), cada una con
 * su propia llave. En servidor siempre vale false para que el HTML no cambie entre visitas. */

export function createStoredFlag(key: string) {
  const listeners = new Set<() => void>();
  let memory = false;

  function read(): boolean {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? memory : v === "1";
    } catch {
      return memory;
    }
  }

  function write(value: boolean) {
    memory = value;
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      /* queda en memoria */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }

  function useFlag(): boolean {
    return useSyncExternalStore(subscribe, read, () => false);
  }

  return { useFlag, write };
}
