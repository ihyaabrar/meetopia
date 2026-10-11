# Meetopia 3D — master vertical slice / phase 1

Implemented 11 October 2026, following `MEETOPIA-3D-RESEARCH.md`. This is an isolated prototype at `/3d-lab`, **not a completed migration of `/app`**. Existing profiles, room maps, authentication, 2D assets and realtime protocol are unchanged. The 2D asset lab links to this prototype.

## Available now

- Three.js 0.186.1 with React Three Fiber 9.8.1, loaded only on the client through a dynamic boundary. R3F 9 matches the existing React 19 major; see [official compatibility guidance](https://r3f.docs.pmnd.rs/getting-started/introduction).
- An original, procedural, fully volumetric chibi master: 11-bone skeleton and weighted body/clothing/hair geometry. No avatar or furniture PNG is used as a 3D billboard. Three test looks: green hoodie, blue spiky hair with jacket/glasses, and brown bob hair. Six skin swatches. These are calibration presets, not the complete avatar editor/catalog.
- Independently modelled oak desk, rolling office chair, monitor, keyboard, mouse, notebook, pen, coffee mug and footrest. Monitor front and back are different physical surfaces. Shelf, books, plants, floor lamp, plank floor, cutaway walls, window and acoustic panel complete the master scene.
- Orthographic diorama camera, restricted orbit, zoom/reset, four close inspection viewpoints, optional grid/contact markers and avatar-isolation mode.
- WASD/arrows and shift movement, click-to-walk navigation with inflated furniture footprints, E to sit/stand, buttons for walking/sitting/typing/standing. Approach, seat transition, seated pose, typing and exit are distinct states. Changing station rotation resets a partially active transition deliberately.
- Desk, chair, operator facing, approach and keyboard sockets rotate in the same coordinate frame at 0/90/180/270 degrees. Hand contact is solved with two-segment IK in the local sagittal plane. The chibi's short shins use a modelled footrest; do not extend the shins just to reach an adult-height floor/desk.
- Responsive lab panel, keyboard focus indication, reduced decorative motion, rendering error boundary, WebGL fallback/context-loss message and cleanup for controls, geometry, materials and skeletons.

## Coordinate contract

Source of truth: `src/shared/spatial/workstation3d.ts`. One unit is one metre; Y is up; +Z is the character's bind-pose forward direction. Positive yaw rotates +Z toward +X. Avatar root sits on the floor; the hip bone moves separately. The desk is 1.70 × 0.76 × 0.72 m; chair cushion top is 0.42 m; seated hip is 0.48 m; footrest top is approximately 0.166 m. Do not mix these with legacy tile pixels.

The desk is opaque and naturally hides part of the seated avatar from the front. Use **Isolasi avatar** to inspect wardrobe/neck seams without the monitor or chair obstructing them. A seated avatar in isolation remains in its seated pose with the supporting furniture intentionally hidden.

## Implementation boundaries

- `src/features/avatar3d/master-avatar.ts`: original geometry, rig, skin weights and master pose sampling. One independent skeleton/material set per avatar. Geometry is batched by material.
- `src/features/world3d/model-kit.ts`: reusable volumetric geometry construction and explicit disposal.
- `src/features/world3d/master-furniture.ts`: standalone prop geometry, statically batched by material.
- `src/features/world3d/lab-controller.ts`: pure, testable local movement and seat state machine.
- `src/features/world3d/WorldLabCanvas.tsx`: GPU world, picking, lights, camera and animation loop. High-frequency motion is held in refs, not React state per frame; diagnostic UI is sampled at 5 Hz.
- `src/features/world3d/WorldLab.tsx`: accessible DOM controls and isolated lab state, not persisted profile state.

This is a kinematic authoring/calibration fixture. Its navigation and seat logic are **not** a new authoritative multiplayer implementation. It does not reserve a server seat, load production maps, send movement to RoomClient, or claim to replace media/proximity privacy checks. There are no imported third-party avatar/furniture assets or restrictive reference-repository code.

## Verification

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `node scripts/check-3d-lab.mjs`, `node scripts/check-asset-lab-ui.mjs`.

Unit coverage includes four rotated seat cycles, navigation collision, frame-delta cap, interrupted transitions, IK reach, normalized skin weights, independent rigs, head/neck overlap, hands at keyboard, supported feet and standalone furniture construction. Browser coverage includes actual WebGL render, movement, seat/type/stand cycles, three looks, camera viewpoints/orbit, isolation, controls and 390px responsive overflow. Browser captures are under ignored `.data/3d-master/` and must be visually inspected separately from numeric tests.

Recorded results: full unit suite 231 passing; the final curved-undershirt geometry revision also passed the 13 scoped 3D tests. TypeScript, lint and optimized Next.js build passed. Both the 3D browser flow and legacy 2D asset-lab browser check passed with no page errors or horizontal overflow. Final visual acceptance against the owner's references remains a separate review, not something unit tests certify. The procedural avatar is approximately 20k triangles before render/shadow-pass multiplication; LOD reduction is still needed before scaling to many remote avatars.

The browser checker uses local Chrome in headless mode with a software-renderer fallback. It establishes behavior and screenshots, **not a hardware FPS benchmark**. Render diagnostics include shadow-pass work. R3F 9 currently emits an upstream `THREE.Clock` deprecation warning with Three 0.186; this is not a page error and we do not patch `node_modules` to hide it.

## Still pending — not represented as complete

1. Visual approval/refinement of the master silhouette, hairstyle, clothing deformation, materials and chair ergonomics against the supplied references. Procedural geometry is an editable master, not a final Blender/GLB asset pack.
2. Full wardrobe, gender/body/face selections and all 44 actions. The prototype has only the walking/seat/typing cycle; it does not contain all interaction, work or condition clips.
3. Blender/glTF production assets, common humanoid rig/retarget pipeline, face expressions, hand shapes and final contact/pose polish.
4. Complete furniture catalog, sofa/stool/bed contact variants, walls/doors/nav metadata, asset editor and thumbnails from real models.
5. Five 3D worlds (office, home, gaming house, creative studio, tropical rooftop) with their own layouts/materials, not five background images.
6. Production RoomClient adapter, authoritative seat leases and world transforms, remote-avatar interpolation, privacy-preserving media/audio boundaries, migration and rollback.
7. Complete landing/auth/onboarding/avatar-studio and in-app UI redesign; keep accessible functional controls in HTML.
8. Production/mobile GPU budgets, LOD/instancing/loading policy, context restoration and multi-user soak tests. No production-performance certification yet.

Next: use this master for proportion/contact review, then extend the same schema/rig into the asset catalog and first production office. Do not mass-produce five worlds before the master is accepted.
