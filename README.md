# Harcourt Kanban

A simple shared board for keeping on top of house jobs. It runs as an app on both our phones, and changes show up live for both of us.

- **Three columns:** To do, Doing, Done. Swipe sideways on a phone; on a laptop you see all three.
- **Each job can have:** who's doing it, a type (Cleaning, Garden, Repairs, Bills, Shopping, Admin), a due date and notes.
- **Repeating jobs:** set "Repeats" to weekly, monthly and so on. When you finish one, the next one appears in To do with a new due date. Good for bins, bills and filter changes.
- **The → button** moves a job to the next column. Tap the job itself to edit it.
- **Filter chips** at the top show everyone's jobs or just one person's.

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
2. In this repo, edit [`config.js`](config.js): paste them into `SUPABASE_URL` and `SUPABASE_ANON_KEY`. While you're there, change `PEOPLE` to your names.
3. Commit. The app updates in a minute or two.

> The anon key is meant to be public. It can't read anything unless you're signed in **and** your email is in the members list.

### 5. Put it on your phones

- **iPhone (Safari):** open the app link, tap **Share → Add to Home Screen**.
- **Android (Chrome):** open the app link, tap **⋮ → Install app** (or **Add to Home screen**).

Open it from the home screen and sign in once. It remembers you.

---

## Changing things

Everything you'd want to tweak is in [`config.js`](config.js): names, columns and job types (with colours).

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
