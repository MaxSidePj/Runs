# Stride — a private running dashboard for your iPhone

A separate GitHub Pages app for a 10-mile goal. Your stock app stays in its existing
repository. This app has no server, subscription, API bill or account system.

## Install on your iPhone

1. Unzip `stride-running-app.zip` in Files and open `running-app`.
2. In your personal GitHub account, create a **new public repository**, for example
   `Runs`. Do not upload these files into `Stcks`.
3. Upload this folder's contents into the new repository root, then commit.
   Keep filenames unchanged. Do not put them inside a `running-app` subfolder.
4. Add the supplied workflow as `.github/workflows/pages.yml`. If Files hides the
   `.github` folder, copy the visible `daily-workflow.txt` into a new file with that
   exact path in GitHub. It only publishes application files; it does not save health data.
5. In repository **Settings → Pages → Source**, choose **GitHub Actions**.
6. Open **Actions → Publish Stride → Run workflow**, choose `main`, and wait for green.
7. Open `https://YOUR-USERNAME.github.io/Runs/` in Safari. Tap **Share → Add to Home Screen**.
8. Open Stride from that home-screen icon. In **Settings**, enter your usual weekly
   kilometres, longest recent run, current frequency, **chosen target runs per week**,
   available days, and optional race date. You set these inside the app.

Use one copy of the app consistently. Safari and installed home-screen web apps can
have separate storage. The app is usable offline after its first complete online load.

## Log and adapt

- Add and edit runs or walks with date, distance, duration, perceived effort and notes.
- Choose 2–5 target runs per week. Runs remaining in the week are recalculated after
  you log what you actually did. Walks are retained but do not count as running mileage.
- Starting from zero uses up to three run/walk sessions. Other available days can
  be used for walking and recovery. Training more frequently does not automatically
  increase total kilometres.
- Next-session suggestions use your baseline, logged running volume, rest intervals,
  effort, a daily fatigue/pain check-in and optional race date.
- No suggested session is automatically recorded as completed.
- A small optional progression needs two complete consistent logged weeks with
  manageable recorded effort and no reported pain. Unknown effort does not count
  as evidence to increase training. Lighter weeks and race week reduce volume.
- When you report pain, running suggestions pause. The app cannot diagnose injuries
  or assess race readiness. These are conservative planning heuristics, not a
  clinically validated training programme or a replacement for a coach.

## Free Apple Watch / Apple Health route

Record runs or walks with the normal **Workout** app on your Apple Watch. They are
stored in **Health** on your iPhone. To bring them into Stride without a paid account:

1. Open **Health → your profile picture → Export All Health Data**.
2. Save the export ZIP to Files, then unzip it.
3. In Stride, open **Run log → Import runs** and choose **export.xml** inside
   `apple_health_export`.
4. Review the distances and durations, then tap **Import activities**.

The importer reads the XML in chunks and extracts running/walking workout summaries
only. It supports both older total-distance attributes and newer WorkoutStatistics
distance entries. Other Health records are discarded; the file is never uploaded.
Repeated imports from the same format are deduplicated. Importing the same run from
both Apple and Strava can still create a duplicate: choose one ongoing import source.
Unsupported workouts or workouts without usable distance/duration are skipped with
a preview count. Use manual entry for missing details.

**This is file import, not automatic sync.** A GitHub Pages website cannot directly
read HealthKit or pull workouts in the background. Apple supports Workout-ended
Shortcut triggers, but that does not establish a reliable free route for reading
complete workout metrics and writing into this web app. That connection has not
been implemented or verified on an iPhone.

## Strava without a subscription

Automatic Strava API sync is not connected. Strava's current developer documentation
requires a subscription to register an API app, and OAuth also requires confidential
server-side credentials; those must not be put into public JavaScript.

You can still import your own Strava **activities CSV**, **GPX** or **TCX** files:

- CSV: choose the exported distance unit explicitly (km, miles or metres), preview
  the values and save. English Strava headers or the app's own CSV export are supported.
  Duration columns must contain seconds or h:mm:ss/m:ss. Other languages may need
  their column headers renamed first.
- GPX: distance is estimated from track points; duration is elapsed time, including
  pauses. Preview it and correct inaccurate GPS summaries manually.
- TCX: distance and duration use the lap summaries. Choose Run or Walk in the importer.
- FIT files are not supported by this first version; use Health XML, TCX, GPX, CSV
  or manual entry instead.

## Storage and backups

Activities and settings are stored only in the browser's local storage on this device.
They are **not** committed to GitHub, sent to an AI service, or synced to another phone.
Public visitors see the app code and their own empty local log, not your activities.
No GPS coordinates are retained after an import.

Use **Back up ↗** regularly and save the JSON in Files/iCloud Drive. Restore merges
missing activities and restores settings after confirmation. Clearing browser data,
changing the site address, changing phone or removing the app can lose your local log.
The app reports failed writes rather than silently claiming that data was saved.

## Sources and verification limits

- [Apple: export your Health data](https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios).
- [Apple: HealthKit](https://developer.apple.com/documentation/healthkit).
- [Apple: Workout automation triggers](https://support.apple.com/en-ph/guide/shortcuts/apd932ff833f/ios).
- [Strava: API app subscription and authentication](https://developers.strava.com/docs/getting-started/).
- [Strava: export your data](https://support.strava.com/en-us/articles/15401919-how-do-i-export-my-strava-data).
- [NHS: beginner run/walk structure and rest days](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/).

No real personal activities are bundled. The app is built and tested locally; it
still needs uploading and a real iPhone check. No Strava/Apple account is connected.
