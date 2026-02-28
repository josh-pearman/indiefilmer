export const SCENE_EXTRACTION_PROMPT = `You are a script breakdown assistant. I am uploading a feature film screenplay PDF. Please analyze every scene in the script and return a JSON object containing all locations, cast, and scenes.

Return a JSON object with three top-level keys: "locations", "cast", and "scenes".

## LOCATIONS

For the "locations" array, identify every unique filming location in the script. Each distinct space in the script should be its own location — because in film production, any space might be filmed at a completely different real-world location, even if the script treats them as part of the same building.

For each location:

- **locationName** (string, required): A clean, readable name for the location exactly as described in the script. Use title case. Preserve the specificity of sub-locations.

CRITICAL RULES for locations:
- Every distinct space is its OWN location. "JAKE'S APARTMENT - KITCHEN" and "JAKE'S APARTMENT - BEDROOM" are TWO separate locations ("Jake's Apartment - Kitchen" and "Jake's Apartment - Bedroom"), because in production these may be filmed in entirely different real-world places.
- Similarly, "HOSPITAL - LOBBY" and "HOSPITAL - OPERATING ROOM" are TWO locations.
- Only MERGE entries that are clearly the same physical space appearing with minor variations:
  - DAY/NIGHT variants: "INT. JAKE'S BEDROOM - DAY" and "INT. JAKE'S BEDROOM - NIGHT" → one location "Jake's Bedroom"
  - Minor spelling differences: "JAKES APARTMENT" and "JAKE'S APARTMENT" → one location
  - CONTINUOUS/LATER/MOMENTS LATER: "INT. KITCHEN - LATER" and "INT. KITCHEN - DAY" → one location "Kitchen"
- When in doubt, keep locations SEPARATE. It is easier for the user to merge two locations than to split one.
- Vehicles are their own locations (e.g., "Jake's Car", "Police Cruiser")
- Generic unnamed locations should be given a descriptive name (e.g., "EXT. STREET" → "Street", "INT. WAREHOUSE" → "Warehouse")

Examples:
  "INT. JAKE'S APARTMENT - KITCHEN - DAY" → "Jake's Apartment - Kitchen"
  "INT. JAKE'S APARTMENT - BEDROOM - NIGHT" → "Jake's Apartment - Bedroom"  (separate location)
  "INT. JAKE'S APARTMENT - KITCHEN - NIGHT" → "Jake's Apartment - Kitchen"  (same as the DAY version — merged)
  "EXT. CENTRAL PARK - DAY" → "Central Park"
  "EXT. CENTRAL PARK - FOUNTAIN - DAY" → "Central Park - Fountain"  (separate location)
  "INT. JAKE'S CAR - NIGHT" → "Jake's Car"

## CAST

For the "cast" array, identify every named character who has dialogue or significant action in the script. For each character:

- **characterName** (string, required): The character's name exactly as it appears in dialogue headings (e.g., "JAKE", "SARAH", "DR. MARTINEZ"). Use the most common version if the script uses variations.
- **roleName** (string, optional): A brief role description (e.g., "Lead - detective protagonist", "Supporting - Jake's partner", "Minor - cafe waitress"). Indicate Lead/Supporting/Minor and a short description.

## SCENES

For the "scenes" array, extract every scene in the script. For each scene:

- **sceneNumber** (string, required): The scene number as written in the script (e.g., "1", "2A", "14B"). If scenes are not numbered, assign sequential numbers starting from "1".
- **title** (string, optional): A short descriptive title for the scene (2-6 words). Generate this from the scene content — it should help identify the scene at a glance (e.g., "Jake meets Sarah", "The car chase", "Morning at the diner").
- **intExt** (string): Either "INT" or "EXT" based on the scene heading. If the heading says "INT./EXT." or "I/E", use "EXT".
- **dayNight** (string): Either "DAY" or "NIGHT" based on the scene heading. If the heading says "DAWN", "DUSK", "MORNING", or "EVENING", map to the closest: DAWN/MORNING → "DAY", DUSK/EVENING → "NIGHT". If not specified, use "DAY".
- **pageCount** (number): Estimated page length of the scene. Use decimals (e.g., 0.5, 1.25, 2.5). One page of screenplay ≈ one minute of screen time. Estimate based on the amount of text in the scene.
- **synopsis** (string, optional): 1-2 sentence summary of what happens in the scene. Be concise and specific — focus on actions and plot points, not mood or description.
- **locationName** (string): The location name this scene takes place at. MUST exactly match one of the locationName values from the locations array. This is how scenes are linked to locations.
- **characters** (array of strings): List every named character who appears in this scene (has dialogue or is described performing action). Use the exact same characterName strings from the cast array so they can be linked. Do NOT include unnamed extras or background characters.
- **tags** (array of strings): Infer which of these production tags apply to the scene based on its content. Only include tags that clearly apply:
  - "sound_risk" — Scenes near highways, airports, construction, busy streets, or anywhere ambient noise would be a problem for audio recording
  - "permit_risk" — Scenes in public locations that would likely require filming permits (streets, parks, government buildings, businesses)
  - "stunts" — Any physical action beyond normal movement: fights, falls, car chases, running, physical altercations
  - "intimacy" — Romantic scenes, kissing, sex scenes, nudity, or any scene requiring an intimacy coordinator
  - "vfx" — Scenes requiring visual effects: green screen, CGI, compositing, screen replacements, anything not practically achievable on set
  - "special_props" — Scenes requiring notable props: weapons (real or fake), breakaway furniture, food that needs to look specific, specialty vehicles, period-specific items
  - "crowd" — Scenes with more than ~10 background actors/extras
  - "night_ext" — Exterior scenes at night (these require special lighting and are expensive)

Return ONLY a valid JSON object with no additional text, no markdown code fences, no explanation. The response should start with { and end with }.

Example output format:
{
  "locations": [
    { "locationName": "Jake's Apartment - Kitchen" },
    { "locationName": "Jake's Apartment - Bedroom" },
    { "locationName": "Downtown Bar" },
    { "locationName": "City Alley" },
    { "locationName": "Police Station - Lobby" },
    { "locationName": "Police Station - Interrogation Room" }
  ],
  "cast": [
    { "characterName": "JAKE", "roleName": "Lead - detective protagonist" },
    { "characterName": "SARAH", "roleName": "Supporting - Jake's partner" },
    { "characterName": "MARCUS", "roleName": "Supporting - antagonist" },
    { "characterName": "RECEPTIONIST", "roleName": "Minor - police station receptionist" }
  ],
  "scenes": [
    {
      "sceneNumber": "1",
      "title": "Jake arrives at the station",
      "intExt": "INT",
      "dayNight": "DAY",
      "pageCount": 1.5,
      "synopsis": "Jake walks into the police station lobby and greets the receptionist. He notices something is off.",
      "locationName": "Police Station - Lobby",
      "characters": ["JAKE", "RECEPTIONIST"],
      "tags": []
    },
    {
      "sceneNumber": "2",
      "title": "Alley confrontation",
      "intExt": "EXT",
      "dayNight": "NIGHT",
      "pageCount": 2.0,
      "synopsis": "Jake confronts Marcus in the alley behind the bar. A fight breaks out.",
      "locationName": "City Alley",
      "characters": ["JAKE", "MARCUS"],
      "tags": ["stunts", "night_ext", "sound_risk"]
    }
  ]
}

Important:
- Extract EVERY scene in the script, not just a sample
- Identify EVERY named character with dialogue or significant action
- Keep distinct spaces as SEPARATE locations — only merge true duplicates (DAY/NIGHT same space, minor misspellings, CONTINUOUS/LATER)
- Every scene's locationName MUST exactly match one locationName from the locations array
- Character names in the "characters" array within each scene MUST exactly match a characterName in the "cast" array
- Scene numbers must match what is written in the script
- Be conservative with tags — only include ones clearly supported by the scene content
- Page counts should add up to approximately the total page count of the script
- Return valid JSON only — no extra text before or after the object`;
