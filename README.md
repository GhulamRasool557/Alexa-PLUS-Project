# Alexa PLUS (Jarvis)

Voice and text control through an Alexa skill called **Jarvis** and your own backend.

```
backend/   Node.js + Express server: Alexa endpoint (/alexa), text commands (/api/command),
           live link to screens (Socket.IO), and serves the website
web/       React dashboard (Vite): YouTube player, command chat box
skill/     Alexa skill manifest and interaction model (paste into the Alexa developer console)
render.yaml  One-click deploy config for Render (one service runs everything)
```

## Status

| Step | What | State |
|---|---|---|
| 1 | Backend + Jarvis skill, "hello" works | Built and tested locally |
| 2 | Website with YouTube | Built and tested locally |
| 3 | Chrome, Claude, WhatsApp, VS Code | Built and tested locally |
| 4 | To-dos and alarms (MongoDB Atlas, Reminders API) | Built and tested locally |
| 5 | Echo display text (APL-T) | Built and tested locally |
| 6 | Android app (calls, locked-phone control) | Next |
| 7 | Cloud deploy, test with laptop off | |

## How a command flows

Every input, whether Alexa voice or typed text, goes through one router
(`backend/src/commands/router.js`) and returns `{ speech, display, action }`.
The skill uses a catch-all slot, so anything you say after "Alexa, open Jarvis"
reaches the backend as plain text. Adding a command means adding one handler there.

Short spoken answers come from DuckDuckGo and Wikipedia (free, no key needed).

Commands that need a screen (like YouTube) are pushed live to every open dashboard.
If no dashboard is open, Jarvis says "No screen is connected".

## Commands so far

| Say or type | What happens |
|---|---|
| hello | Jarvis greets you |
| open youtube | YouTube panel opens on your dashboard |
| play *lofi music* (on youtube) | Searches YouTube and plays the top result inside your dashboard |
| stop the video | Stops playback |
| open chrome / google | Opens Google in a new tab |
| open claude / whatsapp / vs code / gmail / github | Opens that site in a new tab |
| ask claude *to write a poem* | Opens Claude with your question already typed in |
| search for *weather in lahore* (or google *X*, look up *X*) | Alexa reads a short answer; full Google results open on screen |
| what is / who is / how far is *...* | Same as search |
| add *buy milk* to my to-do list | Saves it (also: "put X on my list", "add a to-do X") |
| read my to-do list / what's on my list | Alexa reads them back |
| remove *buy milk* / mark number 2 done | Ticks it off |
| clear my to-do list | Ticks everything off |
| set an alarm for *7 AM* / wake me up in *20 minutes* | Rings on the Echo Dot (voice only) |
| remind me to *drink water* at *5 PM* / in *10 minutes* | Echo Dot says the reminder at that time (voice only) |

Every reply also shows a few characters on the Echo Dot's clock, like `HI :)`, `YT ON`, `ADDED`, `DONE`.
| help | Lists what Jarvis can do |

## Run locally

```bash
cd backend && npm install
npm test          # uses fake Alexa requests and a fake screen
npm run dev       # backend on http://localhost:3000 with signature checks OFF

cd ../web && npm install
npm run dev       # dashboard on http://localhost:5173, talks to the backend
```

## MongoDB Atlas (to-dos, alarms, history)

1. Sign up at mongodb.com/atlas, create a free **M0** cluster.
2. **Database Access**: add a user with a password. **Network Access**: allow `0.0.0.0/0` (Render's IPs change).
3. **Connect > Drivers**: copy the connection string, put your password in it, and set it as Render's `MONGODB_URI`.

Without it everything still works, but to-dos are forgotten when the server restarts. `/health` shows `"store":"mongo"` once it's connected.

## YouTube API key (so videos play inside your dashboard)

1. Go to console.cloud.google.com, create a project, then **APIs & Services > Library**, enable **YouTube Data API v3**.
2. **Credentials > Create credentials > API key**. Put it in Render's `YOUTUBE_API_KEY`.

It's free for personal use (about 100 searches a day). Without a key, "play X" opens YouTube's own
search page in a new tab instead of playing inside the dashboard.

## Using the dashboard

1. Open `https://<your-app>.onrender.com` on any screen (laptop, TV browser, phone).
2. Enter the `API_KEY` (Render generated it; find it under the service's **Environment** tab). It's remembered on that screen.
3. Tap the "Tap once" bar. Browsers only allow sound and new tabs after one tap on the page.
4. Allow pop-ups for the site once (browser address bar > pop-up icon > Always allow), so Jarvis can open tabs.

## Deploy the backend (Render)

1. Push this folder to a GitHub repo.
2. On render.com: **New > Blueprint**, pick the repo. It reads `render.yaml` and builds the website and backend together.
3. When it is live, open `https://<your-app>.onrender.com/health`; it should show `{"ok":true}`.
4. The free plan sleeps after 15 idle minutes and Alexa times out waiting for it to wake.
   Use the $7/month Starter plan, or a free pinger (e.g. cron-job.org hitting `/health` every 10 minutes).

## Create the Jarvis skill (Alexa developer console)

1. Sign in at developer.amazon.com/alexa/console/ask with the **same Amazon account as your Echo Dot**.
2. **Create Skill**: name `Jarvis`, locale English (US) (match your Echo's language), type **Custom**,
   hosting **Provision your own**, template **Start from scratch**.
3. **Build > Interaction Model > JSON Editor**: paste `skill/interactionModels/custom/en-US.json`, then **Save** and **Build**.
   If the console rejects the one-word invocation name, use `jarvis assistant`.
4. **Build > Endpoint**: choose **HTTPS**, enter `https://<your-app>.onrender.com/alexa`,
   and pick "My development endpoint is a sub-domain of a domain that has a wildcard certificate".
5. Copy **Your Skill ID** from the Endpoint page into Render's `ALEXA_SKILL_ID` env var.
6. **Build > Interfaces**: turn on **Alexa Presentation Language** and tick the character display
   (Echo Dot with clock) option, then **Save Interfaces** and **Build Model** again.
7. **Build > Permissions**: turn on **Reminders**.
8. In the Alexa app on your phone: **More > Skills & Games > Your Skills > Dev > Jarvis > Settings**, allow Reminders.
   (The first time you ask for an alarm, Jarvis also sends a card there asking for this.)
9. **Test** tab: set testing to **Development**, then type or say "open jarvis", then "hello".
   Your Echo Dot can now use it too, no publishing needed.

## Talking to Jarvis

- "Alexa, open Jarvis" → "Jarvis here. What should I do?" → "hello"
- One-shot: "Alexa, ask Jarvis to say hello"
- The session stays open after each reply, so you can keep giving commands; say "stop" to end.
