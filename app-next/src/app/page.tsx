import { AppLobby } from "@/components/lobby/AppLobby";

/** App lobby — pick Driver or Manager; each branch handles its own auth gate. */
export default function HomePage() {
  return <AppLobby />;
}
