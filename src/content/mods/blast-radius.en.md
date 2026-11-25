# blast-radius: a pause before Claude runs a risky command

| Reviewed by ASAI |  |
| --- | --- |
| Mod | blast-radius-asai (ASAI adjustment on blast-radius) |
| Author | Claude Code DevRel, at Anthropic ([anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground)) · Apache-2.0 license |
| Version | 0.1.0-asai.1 (ASAI adjustment on the author's 0.1.0) |
| Reviewed commit | <code>569c5283d9a0a7ee7938df85bb32e4f48cbb8c86</code> |
| Review date | October 25 and 26, 2026 |
| Verdict | Reviewed, ready (as a safety net, not as a lock) |
| Scope | Mac, with the Claude desktop app and Claude Code 2.1.308 |
| Status | Current |

## What it is

blast-radius is a mod for Claude Code (a mod, or plugin, is an add-on that gives Claude Code a new feature). When Claude is about to run a risky shell command, such as deleting a folder with <code>rm -rf</code>, throwing away changes with <code>git reset --hard</code>, forcing a <code>git push --force</code> or running a migration, the mod holds it, measures what it would change and shows you a box with two buttons: <b>Proceed</b> and <b>Cancel</b>. If you cancel, Claude gets the refusal with the reason and does not run the command.

Think of the "are you sure you want to empty the Trash?" prompt, with the exact count of what you would lose. In our live test, before an <code>rm -rf build</code> the box said it would delete 25 files, about 100 KB, and listed the first 10.

What you install is our adjustment, <code>blast-radius-asai</code>: the author's code with ASAI's changes marked and explained in <code>CAMBIOS-ASAI.md</code>, inside the package.

## What it does for you

- <b>You work with permissions in bypass mode.</b> In that mode Claude does not ask before each command. In our test, blast-radius was the only barrier we saw working there: it held <code>rm -rf build</code>, <code>git reset --hard</code>, <code>git push --force origin main</code> and <code>git clean -fd</code>, and after Cancel everything was untouched.
- <b>Deciding with the loss in front of you.</b> The box lists the files that would be deleted, the uncommitted changes that would be thrown away, the remote commits a force push would drop or the untracked paths <code>git clean</code> would remove.
- <b>Commands hidden inside other commands.</b> The original does not look inside <code>bash -c</code>, <code>eval</code>, <code>xargs</code> or <code>timeout</code>. Our adjustment does: in the live test with the adjustment, <code>bash -c 'rm -rf build'</code> was held.
- <b>Databases and deploys.</b> The adjustment adds commands the original does not know, among them the Supabase database reset, <code>psql</code> with <code>drop</code> or <code>truncate</code>, <code>vercel env rm</code>, <code>drizzle-kit push</code> and <code>git branch -D</code>. The full list is in <code>CAMBIOS-ASAI.md</code>.

## What we don't promise

Our verdict says it in one phrase: <b>as a safety net, not as a lock.</b> In practice that means:

- <b>It only watches Claude Code's Bash tool.</b> If Claude runs commands another way (a connector that runs processes, such as Desktop Commander, the app's Terminal or computer control), the mod does not see it. For a hard block, use <code>deny</code> rules in Claude Code's permissions.
- <b>It checks the command text.</b> It does not see what a script, a <code>.sql</code> file or a Python or Node program deletes inside. It also misses some cases that <code>CAMBIOS-ASAI.md</code> lists as known limits, for example a script piped into <code>bash</code>, a command stored in a variable or <code>docker run</code> with a delete inside.
- <b>After Proceed, the command runs as written.</b> The mod does not sandbox it or undo it.
- <b>There will be extra prompts.</b> An <code>rm -f</code> of a single file is held too. <code>psql -f query.sql</code> or a <code>select</code> piped into <code>psql</code> are held even if they only read, because the mod cannot see what they do; we chose it that way. A message or comment that mentions a risky command can be held too.

## What you need before you start

- <b>A Mac.</b> We tested it live on a Mac, with Claude Code 2.1.308.
- <b>The Claude desktop app with Claude Code 2.1.287 or later.</b> The app shipped 2.1.308 during our review. Claude does the installation from a Claude Code session. In our review, the Terminal's <code>claude</code> was on 2.1.77 and did not load the mod.
- <b>Someone at the screen.</b> The mod waits for you to press a button. In a scheduled task, a routine, <code>/loop</code> or a headless session, our adjustment refuses the command at once and asks Claude to tell you. That stops the run, so do not install it on a machine that works on its own.
- <b>bash, git, find and du.</b> These are the tools it measures with; a Mac already has them.

## Installation from Claude Code

You won't type commands. You'll give Claude a message with the exact steps; Claude runs them, shows you the result of each one and stops if something fails.

### Step 1 · Download the package

Download it with the button on this page. It lands in your Downloads folder as a <code>.zip</code> file (or, if you use Safari, already as an <code>asai-mods-blast-radius</code> folder). You don't need to open it: Claude does.

Inside there are three things: the author's mod code with our adjustment (each change marked with <code>ASAI:</code> and explained in <code>CAMBIOS-ASAI.md</code>), the checksum list to confirm nobody changed the code, and the file that registers the package with Claude Code.

### Step 2 · Open a Claude Code session in the app

Open the Claude desktop app and start a new Claude Code session, in any folder.

### Step 3 · Paste this message and send it

Copy the whole box, paste it into the session and send it.

```txt
Install the blast-radius-asai 0.1.0-asai.1 mod reviewed by ASAI. Run these commands one by one, in this order and without changing them. Show me the result of each one. If any fails, or a result is not the one I describe, stop and explain what happened; do not try another way. Do not touch any other file.

1. Check there is no earlier installation. If it says "YA EXISTE", stop and ask me:
test -e ~/asai-mods-blast-radius && echo "YA EXISTE ~/asai-mods-blast-radius" || echo "libre"

2. Put the package in my home folder:
if [ -d ~/Downloads/asai-mods-blast-radius ]; then mv ~/Downloads/asai-mods-blast-radius ~/asai-mods-blast-radius; else Z=$(ls -t ~/Downloads/*asai-mods*blast-radius*.zip | head -1) && mkdir -p ~/Downloads/asai-mods-blast-radius-descomprimido && unzip -q -o "$Z" -d ~/Downloads/asai-mods-blast-radius-descomprimido && mv ~/Downloads/asai-mods-blast-radius-descomprimido/asai-mods-blast-radius ~/asai-mods-blast-radius && rmdir ~/Downloads/asai-mods-blast-radius-descomprimido; fi

3. Check the checksums. There must be 8 OK lines and "HUELLAS CORRECTAS" at the end. If you see FAILED or "did NOT match", stop and install nothing:
cd ~/asai-mods-blast-radius && grep ' plugins/blast-radius-asai/' SHA256SUMS.txt | shasum -a 256 -c && echo "HUELLAS CORRECTAS"

4. Register ASAI's marketplace for this mod:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace add ~/asai-mods-blast-radius

5. Install the mod:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin install blast-radius-asai@asai-mods-blast-radius --scope user

6. Confirm the installation. blast-radius-asai@asai-mods-blast-radius must appear with Version 0.1.0-asai.1 and Status enabled:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin list

When you finish, tell me in one line whether everything went well and remind me to quit the Claude app completely (Cmd + Q) and open it again.
```

### Step 4 · Accept the permissions

Claude Code may ask for permission before each command. Check that it's the one for the current step and accept it.

### Step 5 · Read what Claude tells you

If everything went well, Claude tells you the mod is installed with version 0.1.0-asai.1. If it stopped, it explains at which step and why. The most common cases:

- <b>"YA EXISTE \~/asai-mods-blast-radius" (step 1):</b> you had already installed it or started before. Ask Claude to show you what is in that folder before deciding.
- <b>Checksums with FAILED (step 3):</b> the code is not the one we reviewed. Stop and write to us.
- <b>"command not found: claude" (step 4):</b> the session did not find the Claude Code program. Write to us and we'll give you the installation from the Terminal.

### Step 6 · Restart the app

Quit the Claude app completely (Cmd + Q, not just the window) and open it again. The Claude Code sessions you open from now on load the mod.

<b>Important:</b> don't move or delete the <code>asai-mods-blast-radius</code> folder in your home folder. Claude Code reads the mod from there.

## How to know it works

Until Claude tries a command on the list, the mod shows nothing. To check it, <b>in a test folder</b> you don't care about, ask Claude something like "delete the build folder with rm -rf build". The box should appear with what would be deleted and the Proceed and Cancel buttons.

- Press <code>1</code> for Proceed or <code>2</code> for Cancel; you can also click the button. When the box opens, Cancel has the focus, so Enter refuses the command.
- If you interrupt the turn, the command is refused.
- If the window is narrow, the box shows in the band above the text box instead of a side pane.

<b>To be honest:</b> both of our live tests ran in the app's Terminal panel. We have not yet seen how the box looks in the app's Code tab.

## How to turn it off or remove it

<b>Turn it off or on:</b> in a Claude Code session type <code>/plugin</code>, go to the Installed tab and turn it off or on there. The environment variable <code>BLAST_RADIUS_ASAI=off</code> also turns it off.

<b>Remove it completely</b>: ask Claude to run these two commands, in this order, then restart the app.

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin uninstall blast-radius-asai@asai-mods-blast-radius --scope user
```

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace remove asai-mods-blast-radius
```

After that you can move the <code>asai-mods-blast-radius</code> folder in your home folder to the Trash.

<b>Careful with safe mode:</b> <code>claude --safe-mode</code> turns off every mod, this one included. In our test, a session in safe mode and bypass ran <code>git reset --hard</code>, a force push and <code>git clean</code> with nothing stopping them. If you use safe mode, don't count on blast-radius.

## Findings and mitigations

This is what we found while reviewing the code and testing it, with what we recommend.

| # | Finding | Risk | Mitigation |
| --- | --- | --- | --- |
| 1 | It only watches the Bash tool. What runs through Desktop Commander, the app's Terminal or computer control does not go through the mod. | Medium | Treat it as a net. For a hard block, <code>deny</code> rules in Claude Code's permissions. |
| 2 | It checks the command text without interpreting it the way the shell does. The original did not catch <code>bash -c</code>, <code>xargs rm</code>, <code>find -delete</code>, <code>timeout</code> or database and deploy commands. | Medium | Our adjustment looks inside wrapped commands and adds that list; live, it held <code>bash -c 'rm -rf build'</code>. The limits listed in <code>CAMBIOS-ASAI.md</code> remain. |
| 3 | To measure a migration it runs the tool's status command before you decide (for example <code>python3 manage.py showmigrations</code>). That loads the project's code and can connect to whatever database it has configured. | Low to medium | They are read-only commands. Keep in mind that in a folder connected to production they do talk to that database. |
| 4 | With nobody at the screen (scheduled tasks, routines, headless sessions) a held command cannot be approved. | Medium for automation | Our adjustment refuses it at once instead of waiting 10 minutes. Install it only where someone is at the screen. |
| 5 | In a narrow window the box is drawn in the band above the text, which only one mod can use at a time. If another mod takes it, the buttons may not show and the command is refused. | Low | Don't combine it with other mods that draw in that band. |
| 6 | An <code>rm -f</code> of a single file is held too. | Informational | None. |
| 7 | It needs Claude Code 2.1.287 or later. | Informational | Use the desktop app or update the Terminal's <code>claude</code>. |
| 8 | Young project: one author, 3 commits, shared as-is with no support. Coming from Anthropic does not change our rule. | Informational | This review only holds for the commit shown. We review every new version. |
| 9 | <code>--safe-mode</code> turns this mod off too. | High if someone thinks they are protected | Don't use safe mode when you count on the mod. |

## Why ASAI

A mod runs code on your computer, inside your Claude sessions. That's why we don't recommend one just because someone published it: <b>we review every version before recommending it.</b>

<b>What we checked, specifically:</b>

- We read the code of an <b>exact version</b> line by line (commit <code>569c528</code>, a fixed snapshot of the code on GitHub).
- Network: none. It reads no environment variables and writes no files. It reads only what it needs to count files.
- Processes it starts to measure: <code>sleep</code> (to wait for your answer), <code>find</code>, <code>du</code>, read-only git commands (<code>git status</code>, <code>git diff --shortstat</code>, <code>git clean -n</code>, <code>git log</code>) and, for migrations, each tool's status command. Paths go in as arguments, so nothing in them runs.
- If something fails while it measures or waits, it refuses the command.
- Claude Code's validator (<code>claude plugin validate</code>, version 2.1.308) passed the mod.
- We wrote down every finding with its risk and mitigation, and we state in writing <b>what we did not verify.</b> For this version: how the box looks in the app's Code tab, the refusal after 10 minutes with someone present who doesn't answer, behavior with subagents, migrations live, how often detection misses on a normal working day, installation by pasting the message into the app on a new Mac, Windows, Linux and any version after the one shown.

<b>What we adjusted (and only this):</b>

- <b>Wrapped commands.</b> It looks inside <code>bash -c</code>, <code>sh -c</code>, <code>zsh -c</code>, <code>eval</code>, <code>xargs</code>, <code>timeout</code> and other wrappers, and at what runs inside <code>docker exec</code> or <code>ssh</code>.
- <b>Database and deploy commands</b> the original doesn't know: Supabase, <code>psql</code> with <code>drop</code> or <code>truncate</code>, Vercel, <code>drizzle-kit push</code>, <code>git branch -D</code>, <code>git stash drop</code> and others.
- <b>With nobody at the screen, an instant refusal</b> instead of waiting 10 minutes.
- <b>A switch</b>: <code>BLAST_RADIUS_ASAI=off</code> turns it off.

<b>How we checked it:</b> four independent code audits (the last with no blocking findings), 145 of 145 automated tests and two live tests on a Mac with permissions in bypass. In the second, with the adjustment, these were held and left untouched by Cancel: <code>bash -c 'rm -rf build'</code>, <code>git reset --hard</code>, SQL with <code>drop table</code> piped into <code>psql</code> and a <code>drop table</code> inside <code>docker compose exec</code>; a <code>cat</code> with <code>grep</code> went through with no box, and <code>rm -rf build</code> deleted the folder only after Proceed. The package carries SHA-256 checksums so you can confirm it's the one we reviewed (step 3 of the message).

<b>Our commitment:</b> when a new version of the original comes out, we review it before changing this page. The seal only holds for the version shown. Next review: when a new version comes out and, at the latest, in January 2027.

<b>Last review:</b> October 26, 2026 · version 0.1.0-asai.1 · on commit <code>569c528</code>.

## Credit and license

blast-radius is the work of <b>Claude Code DevRel</b>, at Anthropic, in the repository [github.com/anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground). The author shares it as-is, as an example, with no support, and states it is not an official Anthropic product. It is distributed under the <b>Apache-2.0</b> license; the full text is in the package, at <code>plugins/blast-radius-asai/LICENSE</code>. The mod is its author's work; ASAI's part is the review, the adjustment and these instructions. The package's <code>README.md</code> is the author's and describes the original mod; what changes is in <code>CAMBIOS-ASAI.md</code>.
