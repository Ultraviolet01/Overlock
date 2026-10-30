# Overclock

A portrait, one-thumb horde shooter built for Slapjam AI 2. The jam theme is **Speed**. In this game, fire rate is your speed, and speed is your power.

## How to play

- Drag left or right to steer your squad of wizards. They cast spells on their own.
- Speed is everything. The meter at the bottom runs from x1.0 to x5.0, and the faster you go, the faster your spells fly.
- Speed drains fast. Every kill, gate and barrel pushes it back up; every bite knocks it down.
- Your speed multiplies every point of score (shown as `SCORE x3` next to the meter).
- Hit x5 to trigger OVERCLOCK: 5 seconds of piercing spells, a glowing squad and a wider, faster view.
- Enemies that reach your squad latch on and keep biting until you shoot them down. A boss that reaches you keeps smashing.
- Gates come toward you in pairs. Walk through one to take its effect:
  - Gold gates add or multiply wizards: `+8`, `x2`, `x3`.
  - Cyan gates speed you up (`+0.8`), boost spell power, or slow the horde.
  - Red gates take wizards (`-30`) or slow you down (`-1.5`).
- Shoot the wizard and speed gates to raise their number. A red `-30` or `-1.5` climbs toward zero, flips color, and then helps you.
- Every 10 wizards merge into one archmage, so a squad of hundreds stays readable.
- Rune barrels roll down a lane. Shoot one open for piercing bolts, extra spell damage or more wizards. If you don't break it and it reaches your squad, it crashes into it.
- The horde speeds up every 15 seconds and new enemy types join as the waves climb. The first time one appears, its name and a tip show on screen.
- Every 5th wave a boss charges at you. Kill it before it reaches your knights. Bosses take turns, then repeat tougher.

## The horde

| Enemy | From wave | What it does |
|---|---|---|
| Cultist | 1 | Basic walker |
| Crawler | 2 | Fast. Shoot it early |
| Brute | 3 | Tough, bites hard |
| Wraith | 4 | Weaves from side to side across the road |
| Bloater | 6 | When popped, blasts every enemy around it (can chain) |
| Shield Skeleton | 7 | Its shield blocks most of each bolt |
| Necromancer | 9 | Stops partway down the road and raises cultists. Kill it first |
| Flesh Slime | 11 | Splits into two small slimes when slain |

## Bosses (every 5th wave, in turn)

| Wave | Boss | Attack |
|---|---|---|
| 5, 25, 45... | The Horror | Marks a red lane where you stand, then slams it. Slide out in time to dodge and gain fire rate |
| 10, 30, 50... | Bone Colossus | Marks spots on the road (one under you), then skulls crash down on them |
| 15, 35, 55... | Brood Mother | Crawlers pour out of her as she comes |
| 20, 40, 60... | Wraith King | Raises a shield that blocks every bolt and calls wraiths, then drops it. Shoot when it's down |
- The game is endless. Chase your best wave, top fire rate and score.

## Captains

- **Blitz:** fastest fire rate, lighter bolts.
- **Bulwark:** slower fire, but hits barely slow you down.
- **Surge:** tap the SURGE button (or Space) to double all speed for 5 seconds, every 20 seconds.

## Screens and settings

- **Home screen (Last War style):** the live 3D road behind everything with your squad marching on it and the airship hovering above. Top left: captain portrait with your best wave as its badge, best fire rate bar, best score and best wave strips. Top right: settings and how to play. Center: logo and a big START button. Bottom: captain tiles; the chosen captain leads the squad on the road.
- **How to play:** an illustrated guide to steering, fire rate, cards, barrels, champions and the horror. It opens on the first launch.
- **Settings:** music and sound effect volume, vibration, screen shake, reset best run, and the version number. Reachable from the title and the pause menu.
- **Opening drop (Last War style):** each run starts with a cursed airship hovering over the road. The knights parachute down to their spot one by one, the airship flies off, and a swipe hint with a sliding hand shows for the first three runs.
- **3D battlefield:** the road, curbs, pine forest, lighting, shadows and every character are real 3D (three.js), seen from behind and above the squad like Last War. The menus, HUD, gates, bolts and numbers are drawn on top. If a device has no WebGL, the game falls back to the 2D battlefield.
- **Camera (Last War style):** the battle is seen from behind and above the squad, looking down the road at an angle. The road narrows toward the top and leans slightly, far things are small, near things are big, and pine forest lines both sides. The squad stands about two thirds of the way down the screen.
- **In game (Last War style):** a small cluster in the top-left corner (captain portrait with the wave number, a wave progress bar, score and kill strips, and how many waves until the next horror), a small pause button top right, and a big fire rate meter at the bottom. During a boss, a huge outlined health number on a fat red bar. Gates are glassy panels with a big number, and brutes and barrels show their health right on them.
- **Pause menu:** resume, how to play, settings, quit to title. The game also pauses by itself when you switch apps or tabs.
- **End screen:** progress bar to the next horror, six stat cards, RUN AGAIN and CHANGE CAPTAIN.

## Controls

- Phone: drag anywhere to steer, tap SURGE for the ability, tap the pause button to pause.
- Desktop: drag with the mouse, or use the arrow keys or A/D. Space triggers SURGE. Escape or P pauses. Keys 1, 2, 3 pick a captain and Enter starts on the title screen.

## Tech

- Phaser 3.80.1 for game logic, menus and HUD, and three.js r147 for the 3D battlefield, both stored in `lib/` so the game needs no internet.
- Plain JavaScript, no build step.
- Character art (knight, champion, cultist, crawler, brute, wraith, bloater, shield skeleton, necromancer, flesh slime, the four bosses, airship) was generated with AI (Higgsfield, Z Image model), then cut out and resized. The knights are drawn from behind, standing straight and holding their crossbows forward up the road, like Last War's soldiers. The files are in `assets/`.
- 3D models: the knight, cultist, crawler, brute and the Horror boss were turned into textured 3D models with AI (Higgsfield, SAM 3D) from the character art, in `assets/models/`. The champion, wraith, bloater, shield skeleton, necromancer, flesh slime, Bone Colossus, Brood Mother, Wraith King and rune barrels are built in code from 3D shapes (`src/world3d.js`).
- Bolts, gates, effects and the 2D fallback are drawn in code at startup, and all sound is made with WebAudio.
- Game size is 720 x 1280 and scales to fit any screen.
- Font: Lilita One (SIL Open Font License, see `assets/fonts/`), bundled so it works offline.

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
- `src/world3d.js`: the 3D battlefield: camera, road, forest, lights, shadows, models and their walk cycles.
- `src/textures.js`: draws the bolts, barrels and effects for the 2D layer.
- `src/scenes/`: boot, title, game and game over screens.
- `scripts/package.sh`: builds the itch.io zip.

## AI use (for the jam disclosure)

- Code: written with Claude Code.
- Character art: generated with Higgsfield (Z Image).
- 3D models: generated with Higgsfield (SAM 3D) from that art.
- Sound and music: synthesized in code written with Claude Code.
