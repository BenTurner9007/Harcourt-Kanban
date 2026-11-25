# Harcourt Kanban

A simple shared board for keeping on top of house jobs. It runs as an app on both our phones, and changes show up live for both of us.

- **This week:** the board it opens on. Everything due in the next 7 days or overdue, anything in progress, and what you've finished this week, across all rooms.
- **How long:** tag jobs as Quick, About an hour or Big job, then tap **Quick** at the top when you've only got a few minutes.
- **Starter jobs:** ⋯ menu → **Add starter jobs** adds ready-made repeating jobs (bins, alarm tests, boiler service, gutters, garden jobs through the year). Edit the list in [`starter-packs.js`](starter-packs.js).
- **A board for every room:** tap the room name at the top to switch between Kitchen, Bathroom, Shed and so on. Each room shows how many jobs are left. **All rooms** shows everything at once.
- **Three columns:** To do, Doing, Done. Swipe sideways on a phone; on a laptop you see all three.
- **Each job can have:** a type (Cleaning, Garden, Repairs, Bills, Shopping, Admin), a due date and notes.
- **Repeating jobs:** set "Repeats" to weekly, monthly, every 3 or 6 months, or yearly. When you finish one, the next one appears in To do with a new due date. Good for bins, bills and filter changes.
- **Photos:** tap a job, then **Take photo** or **Choose photos**. Photos are shrunk before upload and stored privately in Supabase; only the two of you can see them.
- **Room colours:** every room has its own colour on the cards and in the room picker. Change them in `ROOM_COLOURS` in [`config.js`](config.js).
- **Checklists:** break a big job into steps. Tick them off as you go; the card shows a progress bar and the next step.
- **The → button** moves a job to the next column. Tap the job itself to edit it.

The app's code is in this public repo. **The jobs themselves are stored privately** in a free Supabase database that only the two of us can sign in to.

---

## Setup (one time, about 15 minutes)

### 1. Turn on the website (GitHub Pages)

1. In this repo on GitHub, go to **Settings → Pages**.
2. Under **Source** choose **Deploy from a branch**, then pick **main** and **/ (root)**. Save.
3. After a minute the app is live at `https://<your-username>.github.io/Harcourt-Kanban/`.

It opens in **demo mode** at first, which saves cards on that phone only. Steps 2 to 4 switch on sharing.

### 2. Create the database (Supabase, free)

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Any name; pick the **London** region.
2. When it's ready, open **SQL Editor**, paste in everything from [`supabase/schema.sql`](supabase/schema.sql), and **change the two email addresses at the bottom** to yours. Click **Run**.

### 3. Create your two logins

1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password, and tick **Auto confirm user**. Repeat for your partner, using the same emails as in step 2.
3. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". (The database rules already block strangers; this is a second lock.)

### 4. Connect the app to the database

1. In Supabase go to **Project Settings → API** (or **Data API**). Copy the **Project URL** and the **anon public** key.
2. In this repo, edit [`config.js`](config.js): paste them into `SUPABASE_URL` and `SUPABASE_ANON_KEY`. If you want to assign jobs to each other, put your names in `PEOPLE` (it's empty, so assigning is switched off).
3. Commit. The app updates in a minute or two.

> The anon key is meant to be public. It can't read anything unless you're signed in **and** your email is in the members list.

### 5. Put it on your phones

- **iPhone (Safari):** open the app link, tap **Share → Add to Home Screen**.
- **Android (Chrome):** open the app link, tap **⋮ → Install app** (or **Add to Home screen**).

Open it from the home screen and sign in once. It remembers you.

---

## Changing things

Everything you'd want to tweak is in [`config.js`](config.js): names, rooms, columns and job types (with colours).

If you rename a room, jobs saved under the old name won't show on the renamed board (they still appear under **All rooms**, where you can edit them).

If you add or rename a column, keep the `id` of existing columns the same or their cards will disappear from view.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page layout |
| `style.css` | How it looks (follows your phone's light or dark mode) |
| `app.js` | How it works |
| `config.js` | Your settings |
| `sw.js`, `manifest.webmanifest`, `icons/` | Make it installable as a phone app |
| `supabase/schema.sql` | Database setup |
