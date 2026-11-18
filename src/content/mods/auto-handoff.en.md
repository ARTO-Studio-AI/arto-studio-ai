# auto-handoff: an orderly handover for your long conversations with Claude

| Reviewed by ASAI |  |
| --- | --- |
| Mod | auto-handoff |
| Author | Alex Hillman ([@alexknowshtml](https://github.com/alexknowshtml)) · MIT license |
| Version | 0.8.6-asai.2 (ASAI adjustment on the author's 0.8.6) |
| Reviewed commit | <code>8d762ce726c962268e2dbe24c1c60f0889a2fcde</code> |
| Review date | October 26, 2026 |
| Verdict | Reviewed, ready (with the viewer turned off) |
| Scope | Mac, with the Claude desktop app and Claude Code 2.1.308 |
| Status | Current |

## What it is

auto-handoff is a mod for Claude Code (a mod, or plugin, is an add-on that gives Claude Code a new feature). Before a long conversation hits its limit, it asks a Claude model (Sonnet, the one we recommend, or Haiku: your choice) for a handover note: what was done, what was decided, the rules you set and what is still pending. Then it clears the session and opens a new one that reads the note and keeps working.

Think of a shift change: the person leaving writes the next one a note with what happened, what is half done and what must not be touched. auto-handoff writes that note for you. It is an alternative to auto-compaction, which is what Claude Code does on its own when the conversation fills up.

## What it does for you

- <b>Long projects.</b> You have spent hours with Claude on the same job and the conversation is close to its limit. Instead of a summary you did not choose, the new session starts with an orderly note: what was in progress, what was decided and what comes next.
- <b>Decisions you do not want to repeat.</b> You already agreed on a format, a name or a rule ("don't delete anything without asking me"). The ASAI templates ask the note to copy those rules into their own section so the new session keeps applying them.
- <b>Pick up where you left off.</b> The note is saved as a file on your computer. If tomorrow you want to know where you were, you open it and read it.
- <b>A team that shares a method.</b> If several people install the same version with the same templates, every note follows the same structure: work in progress, decisions, rules, numbered to-dos and what is still missing from the project record (the template asks the model to leave out empty sections).

What we do not promise: that the note captures everything. It is a summary written by a model and it can leave things out. That is why the templates ask for rules, traceability and numbered to-dos, and why we suggest reading your first real note carefully.

## What you need before you start

- <b>A Mac.</b> We tested the mod live on a Mac, with the desktop app and Claude Code 2.1.308.
- <b>The Claude desktop app with Claude Code.</b> Claude does the install from a Claude Code session; it is designed so you do not have to open Terminal. If your session cannot find the Claude Code program, Step 5 tells you what to do.
- <b>A Claude plan with room to spare.</b> Each handover uses one call to the model you choose, Sonnet or Haiku, with a good part of the conversation (see "Sonnet or Haiku: who writes the note").
- <b>Time.</b> About 10 minutes (our estimate, not a measurement).

## Install from Claude Code

You will not type commands. You give Claude a message with the exact steps; Claude runs them, shows you each result and stops if something goes wrong.

### Step 1 · Download the package

Download it with the button on this page. It lands in your Downloads folder as a <code>.zip</code> file (or, if you use Safari, already as an <code>asai-mods</code> folder). You do not need to open it: Claude does.

Inside there are three things: the author's mod code with our adjustment (every change marked and explained in <code>CAMBIOS-ASAI.md</code>), the fingerprint list to check that nobody changed the code or the templates, and our handover templates in English and Spanish. The message below installs the English ones, so the note and the new session's first reply come out in English.

### Step 2 · Open a Claude Code session in the app

Open the Claude desktop app and start a new Claude Code session, in any folder.

### Step 3 · Paste this message and send it

Copy the whole box, paste it into the session and send it. Before step 8, Claude will ask which model you want to write the note; we recommend Sonnet (see "Sonnet or Haiku: who writes the note").

```txt
Install the auto-handoff 0.8.6-asai.2 mod reviewed by ASAI. Run these commands one by one, in this order and without changing them; the only thing you change is the word MODEL in step 8. Show me the result of each one. If any of them fails, or a result is not the one I describe, stop and tell me what happened; do not try another way. Do not touch any other file.

1. Check there is no earlier install. If it says "ALREADY EXISTS", stop and ask me:
test -e ~/asai-mods && echo "ALREADY EXISTS ~/asai-mods" || echo "free"

2. Put the package in my home folder:
if [ -d ~/Downloads/asai-mods ]; then mv ~/Downloads/asai-mods ~/asai-mods; else Z=$(ls -t ~/Downloads/*asai-mods*.zip | head -1) && mkdir -p ~/Downloads/asai-mods-unzipped && unzip -q -o "$Z" -d ~/Downloads/asai-mods-unzipped && mv ~/Downloads/asai-mods-unzipped/asai-mods ~/asai-mods && rmdir ~/Downloads/asai-mods-unzipped; fi

3. Check the fingerprints. There must be 25 OK lines and "FINGERPRINTS OK" at the end. If you see FAILED or "did NOT match", stop and do not install anything:
cd ~/asai-mods/plugins/auto-handoff && shasum -a 256 -c ~/asai-mods/SHA256SUMS.txt && echo "FINGERPRINTS OK"

4. Prepare the folders:
mkdir -p ~/.claude/auto-handoff ~/.claude/state/auto-handoff && chmod 700 ~/.claude/state/auto-handoff

5. Copy the English templates without overwriting the ones I may already have:
for f in brief.md instructions.md; do if [ -e ~/.claude/auto-handoff/$f ]; then echo "ALREADY EXISTS $f, not touching it"; else cp ~/asai-mods/plantillas-en/$f ~/.claude/auto-handoff/ && echo "copied $f"; fi; done

6. Register the ASAI marketplace:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace add ~/asai-mods

7. Install the mod (a "7 userConfig options not yet set" notice is normal):
"${CLAUDE_CODE_EXECPATH:-claude}" plugin install auto-handoff@asai-mods

8. Before running this step, ask me which model I want to write the note: Sonnet, the one ASAI recommends (in its blind test on 5 long sessions it won 4 and made half the errors; about USD 0.22 per handover), or Haiku, the original author's (about USD 0.012 per handover, but with more errors). If I do not answer or do not know, use sonnet. Replace MODEL with sonnet or haiku, in lowercase, and run the command to turn the viewer off, set the threshold to 160,000 and set the model:
echo '{"viewer": "off", "threshold": "160000", "briefModel": "MODEL"}' | "${CLAUDE_CODE_EXECPATH:-claude}" plugin configure auto-handoff@asai-mods --values-stdin

9. Confirm the install. auto-handoff@asai-mods must show Version 0.8.6-asai.2 and Status enabled:
"${CLAUDE_CODE_EXECPATH:-claude}" plugin list

When you finish, tell me in one line whether everything worked and which model it was set to, and remind me to quit the Claude app completely (Cmd + Q) and open it again.
```

### Step 4 · Accept the permissions

Claude Code may ask your permission before each command. Check that it is the one for the current step and accept it.

### Step 5 · Read what Claude tells you

If everything worked, Claude tells you the mod is installed at version 0.8.6-asai.2 and with which model. If it stopped, it explains at which step and why. The most common cases:

- <b>"ALREADY EXISTS \~/asai-mods" (step 1):</b> you had installed or started before. Ask Claude to show you what is in that folder before deciding.
- <b>Fingerprints with FAILED (step 3):</b> the code is not the one we reviewed. Do not continue and write to us.
- <b>"command not found: claude" (step 6):</b> the session could not find the Claude Code program. Write to us and we will give you the Terminal install.
- <b>"ALREADY EXISTS </b><code>brief.md</code><b>" (step 5):</b> you had used auto-handoff before and your templates stay. If you want ours, ask Claude to show you those two files before changing them.

### Step 6 · Restart the app

Quit the Claude app completely (Cmd + Q, not just the window) and open it again. The Claude Code sessions you open from now on load the mod.

<b>Important:</b> do not move or delete the <code>asai-mods</code> folder in your home folder. Claude Code reads the mod from there.

## How to tell it is working

Honestly: <b>until the conversation reaches the threshold, the mod shows nothing.</b> There is no icon or permanent notice. What you can check:

1. <b>That it is installed and on:</b> ask Claude in any session to run <code>"${CLAUDE_CODE_EXECPATH:-claude}" plugin list</code> and tell you whether auto-handoff shows as enabled.
2. <b>When it reaches the threshold:</b> the mod lets you know, waits for the model to write the note (Sonnet: 12 to 16 seconds live inside the mod and 19 to 31 in the blind test; Haiku: 43 to 64 in the blind test, we did not run it live) and moves to a new session, which opens saying which session it comes from. That is the sign it worked.
3. <b>That the note was saved:</b> after your first handover, <code>~/.claude/state/auto-handoff</code> holds one <code>.md</code> file per note, plus a <code>pages</code> folder and an <code>auto-handoff.log</code> file; those two are normal.

With a threshold of 160,000 it can take a while before the first handover. That is normal.

## Sonnet or Haiku: who writes the note

When you install it, you choose which model writes the note. <b>We recommend Sonnet</b>, and not on a hunch: we tested it.

- <b>How we tested it.</b> On October 26, 2026 we took 5 real sessions of about 400,000 tokens, from five different projects. For each one we wrote two notes, one with Sonnet and one with Haiku, each with its own reading limits. They were standalone calls, without the answer cap or the one-minute wait that the Haiku option does apply inside the mod (in one of the 5 sessions, Haiku went past the minute). We shuffled them and an independent reviewer graded them against the session's full record without knowing which was which.
- <b>What came out.</b> Sonnet's note won 4 of the 5 and made half the errors (11 against 21). Haiku's was longer and covered more topics, but several times it listed as pending something that was already settled, which sets the new session to redo work.
- <b>What it costs.</b> In the test, about USD 0.22 per handover with Sonnet (0.17 to 0.30) and about USD 0.012 with Haiku: about 19 times less. It comes out of your plan, like the rest of the conversation. A handover comes after a long conversation that has already spent far more than that, and a wrong note is paid for in repeated work.
- <b>How much each one reads.</b> Sonnet reads the last 400 messages and up to 600,000 characters; Haiku, the original's 120 messages and 150,000 characters.
- <b>When Haiku makes sense:</b> if your plan is tight and you hand over often, or if you want the author's behavior as is.

<b>To change it later,</b> ask Claude to run this command (with haiku or sonnet) and then restart the app:

```txt
echo '{"briefModel": "haiku"}' | "${CLAUDE_CODE_EXECPATH:-claude}" plugin configure auto-handoff@asai-mods --values-stdin
```

## How to choose the threshold

The threshold is the conversation size, measured in tokens (the small pieces of text Claude counts), at which the mod hands over. The context window is the most a conversation can hold, also in tokens. The simple rule:

- <b>200,000-token window:</b> threshold of 160,000. This is what the install sets.
- <b>1,000,000-token window:</b> threshold of 400,000. Do not use 80% (800,000): the mod passes the model at most the last 600,000 characters of the conversation with Sonnet (150,000 with Haiku), so with such a high threshold the note would leave out a good part of what came before.
- <b>If you do not know your window:</b> keep 160,000.

<b>Why a very low threshold chains handovers:</b> a new session does not start empty. It already carries the tools, the connectors and the note itself; on our Mac it started at about 46,000 tokens. If the threshold is close to that number, the new session hits the limit almost at once and hands over again. The mod protects itself: it does not hand over again until the session grows at least 40,000 tokens from its start, and it pauses after 2 handovers in a row without you typing anything. Even so, do not go below about 90,000.

<b>To change it,</b> ask Claude to run this command (example with 400,000) and then restart the app:

```txt
echo '{"threshold": "400000"}' | "${CLAUDE_CODE_EXECPATH:-claude}" plugin configure auto-handoff@asai-mods --values-stdin
```

## How to turn it off or remove it

In every case, ask Claude to run the command and then restart the app.

<b>Turn it off for a while</b> (still installed, but inactive):

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin disable auto-handoff@asai-mods --scope user
```

<b>Turn it back on:</b>

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin enable auto-handoff@asai-mods --scope user
```

<b>Remove it completely</b> (two commands, in this order):

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin uninstall auto-handoff@asai-mods --scope user
```

```txt
"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace remove asai-mods
```

After that you can move the <code>asai-mods</code> folder in your home folder to the Trash. The templates stay in <code>~/.claude/auto-handoff</code>; if you want them gone too, delete them from Finder.

<b>Delete old notes:</b> ask Claude to open the folder in Finder with <code>open ~/.claude/state/auto-handoff</code> (a Mac command; we did not test it in this run) and move the <code>.md</code> files and the <code>pages</code> folder you no longer need to the Trash.

## What you should know

- <b>Notes store text from your conversations in plain form</b>, on your own computer, in <code>~/.claude/state/auto-handoff</code>. Anyone with access to your user account can read them.
- <b>Besides the </b><b><code>.md</code></b><b>, the mod saves an </b><b><code>.html</code></b><b> page for each note</b> in the <code>pages</code> folder. If you open it in a browser, it loads Google fonts and two libraries from cdnjs over the internet. The note's text does not leave your computer, but those services do log the visit. To read a note, open the <code>.md</code>. Note: the link the mod shows at handover opens that <code>.html</code> page.
- <b>Do not paste keys or passwords into the chat.</b> Our templates ask the model to write <code>[secret omitted]</code> instead of copying them, but the safe way is for them never to be in the conversation.
- <b>Each handover uses one call to the model you chose</b>, which counts against your plan. In our test, about USD 0.22 per handover with Sonnet and about USD 0.012 with Haiku. We did not measure it on a subscription plan.
- <b>While the note is being written, Claude cannot use tools.</b> Sonnet: 12 to 16 seconds live inside the mod and 19 to 31 in the blind test. Haiku: 43 to 64 in the blind test (we did not run it live). The limit is 3 minutes with Sonnet and 1 minute with Haiku. If it sits like that for a moment, that is normal: do not close the session.
- <b>If the model does not answer</b> (because it goes past its time limit or your organization does not allow that model), the mod still hands over, with a shorter note that only carries the session's facts.
- <b>With Haiku and long sessions, the handover may carry facts only.</b> If Haiku goes past its minute, the mod uses the short note with the session's facts; in our test, one of 5 sessions took more than a minute.
- <b>The note can leave things out.</b> Read the first one carefully. If something important is missing, add it to your project record.
- <b>It does not update itself, on purpose.</b> You install the version we reviewed and it stays that way until you install another one.
- <b>It is only tested where the box says:</b> Mac, Claude desktop app, Claude Code 2.1.308. We have not tested it on Windows or Linux, or with other Claude Code versions. In our review, the Terminal's Claude Code 2.1.77 did not load it.

## Why ASAI

A mod runs code on your computer, inside your Claude sessions. That is why we do not recommend one just because someone published it: <b>we review every version before we recommend it.</b>

<b>What we review, specifically:</b>

- We read the code of an <b>exact version</b> (a commit, a fixed snapshot of the code on GitHub) and record which one.
- We check whether it calls the internet, runs commands, which files it reads and writes, which of your data leaves and where to, and whether it loads third-party resources.
- We record every finding with its risk and its mitigation, meaning the setting or usage rule that handles it.
- We test it live before recommending it.
- We state in writing <b>what we did not verify.</b> For this version: the exact cost on your plan, the Sonnet and Haiku services, the Haiku option live (it is covered by the automated tests and the install), the install by pasting the message inside the app on a new Mac (we did run the commands exactly as written on a Mac, with an empty home folder) and any version after the one shown. We have used the Sonnet version on our own machines since October 26, 2026.

<b>What we adjust (and only this):</b>

- <b>You choose who writes the note, and we recommend Sonnet with data.</b> In the original, Haiku always writes it. With Sonnet, the note sees the last 400 messages and up to 600,000 characters (the original, 120 and 150,000). We tested it blind on 5 real sessions of about 400,000 tokens: Sonnet's note won 4 and made half the errors; Haiku's covered more, but several times listed as pending what was already settled.
- <b>A bug in the original, fixed:</b> if the model call failed, the handover got stuck and Claude could not use tools. Now it falls back to a note with the session's facts and carries on.
- <b>Viewer turned off at install.</b> Our install message turns it off (step 8); the author's code ships with it on and, when on, the mod opens a web page with no password to read the notes and, in our test, left that process running after the session closed.
- <b>Handover templates in English and Spanish,</b> with hard rules, traceability (what is still missing from the project record), numbered to-dos and an instruction not to copy secrets.
- <b>A threshold guide</b> based on your window size.
- <b>An install Claude does for you,</b> with the commands we ran exactly as written, end to end, in clean environments (Linux and Mac, Claude Code 2.1.308).

<b>Only what </b><b><code>CAMBIOS-ASAI.md</code></b><b> explains changes in the author's code:</b> the model option, how much each model reads and how long it waits, and the fallback to the facts note. Every change is marked <code>ASAI:</code> and explained in <code>CAMBIOS-ASAI.md</code>, inside the package. It went through an independent audit and the author's automated tests plus six of ours (87 of 87). The package carries SHA256 fingerprints so anyone can check it is the one we reviewed (step 3 of the message).

<b>Our commitment:</b> when a new version comes out, we review it before we change this page. The seal only applies to the version shown.

<b>Last review:</b> October 26, 2026 · version 0.8.6-asai.2 · on commit <code>8d762ce</code>.

When a new version is under review, you will see at the top of this page: <i>"New version under review. Meanwhile, the package and these instructions are still for the version shown above, the one we reviewed."</i> The page only changes when the new version passes review.

## Credit and license

auto-handoff is the work of <b>Alex Hillman</b> ([@alexknowshtml](https://github.com/alexknowshtml)). Original repository: [github.com/alexknowshtml/claude-auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff). It is distributed under the <b>MIT</b> license; the full text is in the package, at <code>plugins/auto-handoff/LICENSE</code>. ASAI is not the author of the mod: our part is the review, the model adjustment (Sonnet by default, Haiku optional), the English and Spanish templates and these instructions. The package's <code>README.md</code> is the author's and describes the original; where it says Haiku, this version uses the model you chose (Sonnet unless you changed it). The changes are in <code>CAMBIOS-ASAI.md</code>.
