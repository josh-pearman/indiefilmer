# Color-Coded Script by Location — Reusable LLM Prompt Kit

## Overview

This produces a print-ready, color-coded version of any screenplay where each scene is highlighted with a background color corresponding to its filming location. The output is an HTML file that can be viewed in a browser, shared with crew, or printed to a color PDF.

Works with any screenplay and any set of locations. Colors are assigned automatically in a fixed order — you can override any assignment before running.

---

## Step 1: Extract the Screenplay Text

Upload your screenplay PDF to Claude and ask:

> Please extract the full text of this screenplay, preserving the formatting as closely as possible. Keep scene headings (sluglines), character names, dialogue, action lines, and parentheticals in their standard screenplay layout. Output it as plain text. Do not summarize, skip, or paraphrase any part — I need the complete script from the first page to the last.

Save the output. If the script is too long for one response, ask Claude to continue from where it stopped.

---

## Step 2: Build Your Scene-to-Location Map

If you've already done a script extraction (e.g., via indieFilmer's extraction tool), you have this data. If not, you can ask Claude to generate it from the extracted text:

> From the screenplay text above, create a numbered scene-to-location table. For each scene, list:
> - Scene number
> - Location name (from the slugline)
> - INT/EXT
> - DAY/NIGHT
>
> Output as a markdown table.

This gives you a table like:

| Scene # | Location | INT/EXT | DAY/NIGHT |
|---------|----------|---------|-----------|
| 1 | Apartment | INT | NIGHT |
| 2 | Coffee Shop | INT | DAY |
| 3 | Apartment | INT | NIGHT |
| ... | ... | ... | ... |

---

## Step 3: Assign Colors

Colors are assigned automatically to locations in the order they first appear in the script. The first location that shows up gets Color 1, the second new location gets Color 2, and so on.

### Default Color Palette (20 colors)

| Order | Color Name | Hex | Best For Printing |
|-------|-----------|---------|-------------------|
| 1 | Light Blue | #D0E8FF | ✓ |
| 2 | Light Pink | #FFD6E0 | ✓ |
| 3 | Light Yellow | #FFF8D0 | ✓ |
| 4 | Light Green | #D0F0D8 | ✓ |
| 5 | Light Lavender | #E8D8F0 | ✓ |
| 6 | Light Coral | #FFE0D0 | ✓ |
| 7 | Light Mint | #D0F0E8 | ✓ |
| 8 | Light Peach | #FFE8D0 | ✓ |
| 9 | Light Teal | #D0F0F0 | ✓ |
| 10 | Light Gold | #F0E8C8 | ✓ |
| 11 | Light Rose | #F0D0D8 | ✓ |
| 12 | Light Sage | #D8E8D0 | ✓ |
| 13 | Light Sky | #D8E8F8 | ✓ |
| 14 | Light Amber | #F0E0C0 | ✓ |
| 15 | Light Gray | #E0E0E0 | ✓ |
| 16 | Light Lilac | #E0D0F0 | ✓ |
| 17 | Light Butter | #F8F0D0 | ✓ |
| 18 | Light Ice | #D0E8E8 | ✓ |
| 19 | Light Blush | #F8D8D8 | ✓ |
| 20 | Light Sand | #F0E8D8 | ✓ |

If your script has more than 20 locations, additional locations get white (#FFFFFF).

### How auto-assignment works

Walk through the scene list in order. Each time a new location appears for the first time, assign it the next color from the palette.

Example:
- Scene 1: Apartment → Color 1 (Light Blue)
- Scene 2: Coffee Shop → Color 2 (Light Pink)
- Scene 3: Apartment → already assigned Color 1
- Scene 4: Rooftop → Color 3 (Light Yellow)

### Manual overrides

**Before running Step 4**, review the auto-assigned colors and change any you want. Common reasons to override:

- You want a specific location to stand out in a particular color
- Two similar-looking pastel colors ended up on locations that are adjacent in the script
- You want to group related locations (e.g., all rooms in one house) under similar hues

Just edit the Location → Color table before pasting it into the prompt.

---

## Step 4: Generate the Color-Coded Script

Give the LLM the extracted screenplay text, the scene-to-location map, and the color assignments.

---

**Prompt for Step 4 (copy and customize):**

> I have a screenplay and I need you to produce a **single HTML file** that color-codes every scene by its filming location. The output should be viewable in a browser and printable to a color PDF.
>
> ## Rules
>
> 1. Wrap each scene in a `<div>` with a background color matching its location (see color legend below)
> 2. A scene starts at its **scene heading / slugline** (e.g., "INT. COFFEE SHOP - DAY") and ends when the next scene heading begins
> 3. Preserve ALL screenplay formatting — scene headings, action lines, character names centered, dialogue indented, parentheticals, transitions. Do not alter, summarize, or skip any text.
> 4. Use a monospace font (Courier New) at 12pt to match screenplay formatting
> 5. Include a **color legend** at the top of the page showing each location and its color swatch
> 6. Add the scene number in bold at the start of each scene heading
> 7. Apply `page-break-inside: avoid` on shorter scene divs so they don't split across pages when printing (allow breaking on longer scenes)
> 8. Background colors should fill the full width of each scene block
> 9. Add a thin bottom border between scenes for visual separation
> 10. Include a title and date at the very top of the page, above the legend
>
> ## Project Info
>
> - **Title:** [YOUR SCREENPLAY TITLE]
> - **Date:** [TODAY'S DATE or DRAFT DATE]
>
> ## Location → Color Assignments
>
> [PASTE YOUR LOCATION-TO-COLOR TABLE HERE — either auto-generated or manually adjusted]
>
> Example format:
> | Location | Hex |
> |----------|-----|
> | Apartment | #D0E8FF |
> | Coffee Shop | #FFD6E0 |
> | Rooftop | #FFF8D0 |
>
> ## Scene-to-Location Map
>
> [PASTE YOUR SCENE-TO-LOCATION TABLE HERE]
>
> Example format:
> | Scene # | Location | INT/EXT | DAY/NIGHT |
> |---------|----------|---------|-----------|
> | 1 | Apartment | INT | NIGHT |
> | 2 | Coffee Shop | INT | DAY |
>
> ## The Screenplay Text
>
> [PASTE THE EXTRACTED SCREENPLAY TEXT HERE]

---

## Step 5: Save and Print

1. Save the HTML output as `your-script-color-coded.html`
2. Open in Chrome or any browser
3. To view digitally: just open the file — share it with your crew as-is
4. To print as PDF: File → Print → **check "Background graphics"** (Chrome) or "Print backgrounds" (Safari) → Save as PDF

**Important:** Colors won't print unless background graphics/backgrounds is enabled in print settings.

---

## Tips and Troubleshooting

**Script too long for one LLM pass:**
Split the screenplay in half (by scene number), run each half through the prompt separately. Make sure both halves share the same `<style>` block and legend. Combine the HTML bodies afterward.

**Scenes getting wrong colors:**
The LLM matches scenes by their slugline text. If the screenplay uses different wording than your location names (e.g., slugline says "MOTEL - BACK OFFICE" but your table says "Motel Back Office"), add a note in the prompt mapping slugline text → location name.

**Want to tweak colors after the fact:**
Open the HTML file in any text editor. Search for the hex code you want to change and replace it. Each location's color appears in the `<style>` block at the top and in the legend.

**Locations that share a physical space:**
If "Kitchen" and "Living Room" are both in the same house and you want them to read as related, assign them adjacent colors from the palette (e.g., Light Coral and Light Peach).

**More than 20 locations:**
The palette has 20 colors. If you have more locations, you can extend it with additional pastel hex codes, or consolidate minor locations that only appear once.
