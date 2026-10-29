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
- Don't shoot the red `÷` and fire rate trap cards. Shooting makes them worse (`÷2` becomes `÷3`, `-40%` becomes `-50%`).
- Every 10 knights merge into one champion, so a squad of hundreds stays readable.
- Rune barrels roll down a lane. Shoot one open for piercing bolts, extra bolt damage or more knights. If you don't break it and it reaches your squad, it crashes into it.
- The horde speeds up every 15 seconds. Every 5th wave a giant horror charges at you. Kill it before it reaches your knights.
- The horror marks a red lane where your squad stands, then slams it. Slide out of the lane in time to dodge and gain fire rate.
- The game is endless. Chase your best wave, top fire rate and score.

## Captains

- **Blitz:** fastest fire rate, lighter bolts.
- **Bulwark:** slower fire, but hits barely slow you down.
- **Surge:** tap the SURGE button (or Space) to double all speed for 5 seconds, every 20 seconds.

## Screens and settings

- **Title:** settings gear (top left), how to play (top right), best run card, captain picker, big PLAY button.
- **How to play:** an illustrated guide to steering, fire rate, cards, barrels, champions and the horror. It opens on the first launch.
- **Settings:** music and sound effect volume, vibration, screen shake, reset best run, and the version number. Reachable from the title and the pause menu.
- **In game:** pause button (top left), wave and wave progress, how many waves until the next horror, the fire rate gauge, score and best score. During a boss, a skull health bar.
- **Pause menu:** resume, how to play, settings, quit to title. The game also pauses by itself when you switch apps or tabs.
- **End screen:** progress bar to the next horror, six stat cards, RUN AGAIN and CHANGE CAPTAIN.

## Controls

- Phone: drag anywhere to steer, tap SURGE for the ability, tap the pause button to pause.
- Desktop: drag with the mouse, or use the arrow keys or A/D. Space triggers SURGE. Escape or P pauses. Keys 1, 2, 3 pick a captain and Enter starts on the title screen.

## Tech

- Phaser 3.80.1, stored in `lib/` so the game needs no internet.
- Plain JavaScript, no build step.
- Character art (knight, champion, cultist, crawler, brute, horror) was generated with AI (Higgsfield, Z Image model), then cut out and resized. The files are in `assets/`.
- Bolts, road, barrels and effects are drawn in code at startup, and all sound is made with WebAudio.
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
- `src/audio.js`: sound effects and the speed-linked music, with separate volumes.
- `src/ui.js`: buttons, pop-up panels, sliders and toggles, plus the settings, how to play and pause panels.
- `assets/`: AI-generated character sprites.
- `src/textures.js`: draws the bolts, road, barrels and effects.
- `src/scenes/`: boot, title, game and game over screens.
- `scripts/package.sh`: builds the itch.io zip.

## AI use (for the jam disclosure)

- Code: written with Claude Code.
- Character art: generated with Higgsfield (Z Image).
- Sound and music: synthesized in code written with Claude Code.
