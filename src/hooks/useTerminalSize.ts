import { useEffect, useState } from "react";

export function useTerminalSize(): { columns: number; rows: number } {
  const read = () => ({
    columns: process.stdout.columns ?? 100,
    rows: process.stdout.rows ?? 32,
  });

  const [size, setSize] = useState(read);

  useEffect(() => {
    const onResize = () => setSize(read());
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  return size;
}
