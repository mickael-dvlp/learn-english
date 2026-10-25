"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const isEvening = () => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5;
};

/** "Bonjour" by day, "Bonsoir" from 6 pm: the phone's time (the page itself is built in advance). */
export function Greeting() {
  const evening = useSyncExternalStore(subscribe, isEvening, () => true);
  return <>{evening ? "Bonsoir" : "Bonjour"} 👋</>;
}
