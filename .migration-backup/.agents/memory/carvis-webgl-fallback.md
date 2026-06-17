---
name: Carvis WebGL / Three.js orb fallback
description: The Three.js orb crashes in Replit's preview sandbox — OrbCanvas must guard createOrb with try/catch.
---

## Problem
Replit's iframe preview sandbox has no GPU access. `new THREE.WebGLRenderer()` throws "Error creating WebGL context." This crashed the entire React tree in earlier versions.

## Fix
`OrbCanvas.tsx` wraps `createOrb()` in try/catch. On failure, `orbRef.current` stays null and the canvas element renders as a plain black rectangle. The app works fully — voice interface, dashboard, everything — without the orb animation.

**Why it matters:** The orb works perfectly in a real browser tab and in deployed production. The sandbox limitation is environment-specific. Do NOT add a canvas-fallback component or remove Three.js — just keep the try/catch.

**How to apply:** If `createOrb` is ever refactored, preserve the try/catch in the `useEffect` in `OrbCanvas.tsx`.
