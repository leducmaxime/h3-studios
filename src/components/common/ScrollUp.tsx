"use client";

import { useEffect } from "react";

export function ScrollUp() {
  useEffect(() => {
    document.getElementById("root")?.scrollTo(0, 0);
  }, []);

  return null;
}
