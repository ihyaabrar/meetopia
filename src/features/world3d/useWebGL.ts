"use client";

import { useEffect, useState } from "react";

let cached: boolean | null = null;
/** Probe once per page load and release the probe context right away. */
export function webglSupported(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    cached = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** null while unknown (server render / first paint), then whether WebGL can be used. */
export function useWebGL(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(webglSupported()), []);
  return ok;
}
