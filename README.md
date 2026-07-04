# CareerBanyan — the actual website

This is the real, live website — different from the `job-sync` project, which only fills the database with jobs. This one is what visitors actually see and use (signup, login, browsing, saving roles).

It uses the **same Supabase project** you already set up. No new Supabase project needed.

---

## Before you start — one Supabase setting to turn off

By default, Supabase makes new users click a confirmation link in their email before they can log in. To keep signup simple for now:

1. Open your Supabase project.
2. Click **Authentication** in the left sidebar.
3. Click **Sign In / Providers**, then click on **Email**.
4. Find the toggle called **Confirm email** and turn it **off**.
5. Save / it saves automatically.

(You can turn this back on later for extra security — it just adds an extra "check your email" step for new users.)

---

## Step 1 — Create a new, separate GitHub repository

This needs its own repository — don't put it inside your existing `CareerBanyan` repo, since that one already has different files (the daily sync project) using the same file names.

1. Go to **github.com** → click **+** (top right) → **New repository**.
2. Name it `careerbanyan-web`.
3. Leave "Add a README" unchecked. Click **Create repository**.

## Step 2 — Upload the files

1. Download the `careerbanyan-web.zip` file shared in this chat and unzip it.
2. On your new empty repo's page, click **uploading an existing file**.
3. Drag in everything from the unzipped folder — `index.html`, `package.json`, `vite.config.js`, `.gitignore`, `.env.example`, and the whole `src` folder.
4. Click **Commit changes**.

## Step 3 — Put it online with Vercel (free)

1. Go to **vercel.com** → sign up using your GitHub account (this makes Step 4 automatic).
2. Click **Add New...** → **Project**.
3. Find `careerbanyan-web` in the list and click **Import**.
4. Before clicking Deploy, click to expand **Environment Variables** and add these two, one at a time:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | The same Project URL you found earlier for the sync project (`https://xxxxx.supabase.co`) |
   | `VITE_SUPABASE_ANON_KEY` | The **anon** / **public** (or **publishable**) key you copied earlier — NOT the secret/service_role one |

5. Click **Deploy**. Wait about a minute.
6. When it's done, click the link Vercel gives you — that's your live website's address.

⚠️ **One thing to know:** Vercel's free plan is meant for non-commercial use. Once this site is making money (ads, paid listings, etc.), their terms expect you to move to a paid plan (currently $20/month). It's fine to build and test for free now — just don't forget this when you start monetizing.

## Step 4 — Check it actually works

1. Open your live site.
2. Click **Sign up free**, create an account with a real email you can check.
3. If you turned off "Confirm email" in the step above, you should be logged in immediately.
4. Try saving a job (bookmark icon) and adding a skill in Profile — refresh the page and confirm they're still there.

If the page loads but shows "No roles yet," that means the `job-sync` project hasn't successfully run yet — go back to that project's Actions tab and run it manually.

## If something breaks

- **Blank white page** → open the page, right-click → **Inspect** → **Console** tab, and read the red error text. It almost always names the missing piece (commonly a missing or misspelled environment variable).
- **"Missing VITE_SUPABASE_URL" in the console** → you likely typed the environment variable name wrong in Vercel. It must be exactly `VITE_SUPABASE_URL`, capital letters included.
- **Signup says it worked but you can't log in** → "Confirm email" is probably still on. Go turn it off (see the top of this file), then try signing up again with a new account.
- **Any code change** → after uploading a change to GitHub, go to your Vercel project and check the **Deployments** tab; it redeploys automatically within a minute or two.

## What's intentionally not built yet

- **Self-service account deletion.** Deleting a user account safely needs a small server-side step (it can't be done directly from the browser without exposing a powerful key). For now, the Profile page just shows a request message — real deletions would need to be done manually by you in the Supabase dashboard (Authentication → Users → find the person → delete), or I can build the automated version later if you want it.
- **A real domain name** (like `careerbanyan.com`) — you're live on a free `vercel.app` address for now. Buying and connecting a real domain is a separate, small step whenever you're ready.
