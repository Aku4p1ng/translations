# Contributing a translation

You do not need to install anything. Everything happens in your browser, on GitHub.

## Step by step

1. **Find your language.** Open the [`locales/`](locales/) folder and click the file for your language, for
   example `de-DE.json` for German. If your language is missing, [open an issue](../../issues/new) and ask for it.
   A new language has to be added to the website before it can be translated here.
2. **Click the pencil icon** (✏️) at the top right of the file.
3. GitHub offers to **fork the repository**. Accept, this just creates your own copy to work in.
4. **Translate.** Look for lines that end in `null` and replace `null` with your translation in double quotes.

   ```diff
   -    "DEATHS": null,
   +    "DEATHS": "Tode",
   ```

   `null` means *not translated yet*, the website shows the English text for it. Translate as much or as little
   as you like. You can also improve existing translations.
5. Scroll down, describe your change in a sentence and click **Propose changes**.
6. Click **Create pull request**. Done, a maintainer will review it.

## The rules that matter

**Keep the `{curly braces}` exactly as they are.** They are placeholders that the website fills in. You may move
them to fit your grammar, but never rename, translate or remove them.

```diff
-    "daysAgo": "{count} days ago",
+    "daysAgo": "vor {count} Tagen",
```

Writing `{Anzahl}` instead of `{count}` breaks the text. The automated check catches it, but it saves time.

**Plural forms are separated by `|`.** Keep the same number of forms as the English text where your language allows it.

**Do not add HTML tags** (`<b>`, `<br>`, …) that are not in the English text.

**Do not paste the English text as a filler.** If you do not know a translation, leave `null`. English is exactly
what `null` shows, and it keeps the completeness table honest.

**Lists are all or nothing.** A few entries are lists in square brackets. Translate every item, or leave the whole
list as `null`. Never put `null` inside a list and never change the number of items.

**One language per pull request.** It makes review a lot easier.

**`en-US.json`: corrections only.** You may fix typos and wording in the English texts. Do not add or remove entries
and keep every `{placeholder}`, new texts always come from the website itself. The automated check enforces this.

**No machine translation dumps.** Pull requests that fill a whole language with an automatic translation in one go
are not accepted. Small, careful changes are always welcome.

## Game terminology

*The Outlast Trials* is localized. **Use the words the game uses in your language**, not a literal translation.
If you are unsure, start the game in your language and have a look.

| English | Notes |
| ------- | ----- |
| Trials | The missions. |
| Reagents | The players / test subjects. |
| Prestige | Progression after the maximum level. |
| Invasion | The PvP mode. |
| Escalation | The mode with consecutive trials. |
| Murkoff | Company name, never translate. |
| Murkoff Coins | Currency. |
| Bruiser, Hacker, Mender, Watcher, Sealer, Snarler | The Rigs. Use the in-game names. |
| OutlastTrialsStats, TOTStats, TOTStatsMonitor | Names, never translate. |

Names of characters, maps and Rigs stay as the game spells them.

## After you open the pull request

An automated check runs on your pull request. It verifies that the JSON is valid, that every placeholder survived
and that no unknown keys or tags appeared.

If it only complains about formatting or key order, do not worry, a maintainer will fix that for you. If it
complains about a placeholder, the message names the key. Fix it by editing the file again on your fork's branch.

Thank you for helping. 🖤
