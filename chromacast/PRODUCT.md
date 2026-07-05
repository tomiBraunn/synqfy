# Product

## Register

product

## Users

People with smart lights (Home Assistant) and a Spotify subscription who want their room lighting to react to the music they're playing. They use it at home, often in dim/dark ambient settings, while listening to music. The primary job is passive enjoyment — the lights should just follow the music — with occasional manual control (skip, volume, presets).

## Product Purpose

chromacast extracts the dominant colors from the currently playing Spotify track's cover art and applies them to Home Assistant lights in real time. It exists because smart light apps are generic and music-light apps don't integrate with Home Assistant. Success is: lights match the mood of the music with zero manual effort, and the user can tweak when they want.

## Brand Personality

Ambient. Responsive. Effortless.

The interface should feel like a music player that happens to control lights — not a smart home dashboard. Dark, immersive, with the album art as the visual anchor. The accent color is whatever the current track is playing, not a static brand color.

## Anti-references

- Generic smart home dashboards with toggles and grids (Home Assistant's default UI, SmartThings)
- SaaS landing pages with cream backgrounds and purple gradients
- DJ software with dense waveforms and technical readouts
- Apps that look like they're for IT admins (gray panels, status indicators, log feeds)

## Design Principles

- **The music is the interface.** The album art and its colors drive everything. No static decoration.
- **Passive by default, active on demand.** The app should work without interaction. Controls are there when you want them, hidden when you don't.
- **One glance is enough.** Track info, progress, and light state should be readable in under a second. No menus, no tabs, no deep navigation.
- **Ambient over literal.** The UI should feel like it's part of the room's lighting, not a screen you stare at. Glow, transitions, and tinted backgrounds matter.
- **Responsive feedback.** Every action (skip, volume, color change) should have immediate visual feedback in the UI, not just in the room.

## Accessibility & Inclusion

- WCAG AA contrast for all text and controls (4.5:1 minimum)
- Keyboard navigation for all player controls (space=play/pause, arrows=seek/volume)
- `prefers-reduced-motion` support for all transitions and ambient effects
- Touch targets minimum 44x44px for mobile use
