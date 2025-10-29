import { useRef, useEffect } from "react";
import { initGame, destroyGame } from "../trashHikerGame/game";

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      initGame(containerRef.current);
    }
    return () => destroyGame();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
