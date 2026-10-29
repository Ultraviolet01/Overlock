# Overclock

A portrait, one-thumb horde shooter built for Slapjam AI 2. The jam theme is **Speed**. In this game, fire rate is your speed, and speed is your power.

## How to play

- Drag left or right to steer your squad of cursed knights. They shoot on their own.
- Every kill raises your fire rate (the gauge at the top, from x1.0 to x10).
- Every zombie that reaches your line kills knights and slows your fire rate.
- Cards fall toward you. Walk through one to take its effect:
  - Gold cards change the squad: `+8`, `x2`, `x3`.
  - Red cards hurt: `-6`, `÷2`, or fire rate `-40%`.
  - Teal cards boost speed: fire rate `x2`, bolt speed `+50%`, or horde slow for 5 seconds.
- Shoot the `+` and `-` cards to raise their number. A higher fire rate pumps them up faster, and a red `-6` can be turned into a gold `+4`.
- The horde speeds up every 15 seconds. Every 5th wave a giant horror charges at you. Kill it before it reaches your knights.
- The game is endless. Chase your best wave, top fire rate and score.

## Captains

- **Blitz:** fastest fire rate, lighter bolts.
- **Bulwark:** slower fire, but hits barely slow you down.
- **Surge:** tap the SURGE button (or Space) to double all speed for 5 seconds, every 20 seconds.

## Controls

- Phone: drag anywhere to steer, tap SURGE for the ability.
- Desktop: drag with the mouse, or use the arrow keys or A/D. Space triggers SURGE. Keys 1, 2, 3 pick a captain on the title screen.

## Tech

- Phaser 3.80.1, stored in `lib/` so the game needs no internet.
- Plain JavaScript, no build step.
- All art is drawn in code at startup, and all sound is made with WebAudio, so there are no asset files.
- Game size is 720 x 1280 and scales to fit any screen.

## Run it locally

- Serve the folder with any static server, then open the page in a browser:

```bash
python3 -m http.server 8000
```

- Then open http://localhost:8000.

## Upload to itch.io

- Build the zip:

```bash
./scripts/package.sh
```

- This creates `dist/overclock-itch.zip` with `index.html` at the root.
- On itch.io:
  - Create a new project, set Kind of project to **HTML**.
  - Upload the zip and tick **This file will be played in the web browser**.
  - Set the viewport to **720 x 1280**.
  - Turn on **Mobile friendly** with orientation **Portrait**.
  - Enable the fullscreen button.
- Save as a draft, test it on a phone through the itch link, then submit it to the jam.

## Project layout

- `index.html`: page shell, loads the scripts.
- `src/config.js`: tuning values, captains, colors, helpers.
- `src/audio.js`: sound effects and the speed-linked music.
- `src/textures.js`: draws every sprite.
- `src/scenes/`: boot, title, game and game over screens.
- `scripts/package.sh`: builds the itch.io zip.
