import { type ShotlistProfile } from "./shotlist-profiles";

export type ShotlistSceneContext = {
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
  pageCount: number | null;
  synopsis: string | null;
  locationName: string | null;
  characters: string[];
  tags: string[];
};

/**
 * Build a BYOAI prompt for shot list generation.
 * The user copies this into Claude / ChatGPT along with any storyboards or references.
 */
export function buildShotlistPrompt(
  scenes: ShotlistSceneContext[],
  profile: ShotlistProfile,
  shootDayLabel?: string
): string {
  const scenesBlock = scenes
    .map((s) => {
      const parts: string[] = [];
      parts.push(`**Scene ${s.sceneNumber}**`);
      if (s.title) parts[0] += ` — ${s.title}`;

      const header: string[] = [];
      if (s.intExt) header.push(s.intExt);
      if (s.locationName) header.push(s.locationName);
      if (s.dayNight) header.push(s.dayNight);
      if (header.length > 0) parts.push(header.join(" / "));

      if (s.pageCount) parts.push(`Page count: ~${s.pageCount}`);
      if (s.synopsis) parts.push(`Synopsis: ${s.synopsis}`);
      if (s.characters.length > 0)
        parts.push(`Cast in scene: ${s.characters.join(", ")}`);
      if (s.tags.length > 0)
        parts.push(`Production tags: ${s.tags.join(", ")}`);

      return parts.join("\n");
    })
    .join("\n\n");

  return `You are a 1st Assistant Director creating a shot list for ${shootDayLabel ? `"${shootDayLabel}"` : "a shoot day"} on an independent film production. Below are the scenes scheduled for this day, followed by the shooting profile to guide your shot selection.

## Scenes scheduled for this day

${scenesBlock}

## Shooting profile: ${profile.name}

${profile.promptGuidance}

## Instructions

For each scene, generate a list of shots. Each shot should include:

- **sceneNumber** (string): The scene this shot belongs to — must exactly match one of the scene numbers above.
- **shotNumber** (string): A unique label within the scene (e.g., "1", "2", "3A", "3B"). Use letters for related setups.
- **shotSize** (string): One of: WS (wide shot), MWS (medium wide), MS (medium shot), MCU (medium close-up), CU (close-up), ECU (extreme close-up), OTS (over-the-shoulder), POV (point of view), AERIAL, INSERT.
- **cameraAngle** (string, optional): e.g., "eye-level", "low", "high", "dutch", "bird's-eye", "worm's-eye".
- **cameraMovement** (string, optional): e.g., "static", "pan", "tilt", "dolly", "tracking", "handheld", "steadicam", "crane".
- **lens** (string, optional): e.g., "24mm", "35mm", "50mm", "85mm", "wide", "telephoto".
- **description** (string): What the camera sees and what happens in the shot. Be specific — describe the framing, the action, and when the shot starts/ends.
- **subjectOrFocus** (string, optional): The primary subject or character the camera is focused on.
- **notes** (string, optional): Setup notes, special requirements, or important details for the crew (e.g., "needs dolly track", "shoot before sunset", "safety mat required").

Consider the full day's schedule when making shot list decisions:
- If scenes share a location, note where setups can be reused across scenes.
- Flag any shots that are time-sensitive (golden hour, night exteriors, etc.).
- Keep production tags in mind — stunts need safety coverage, intimacy scenes need minimal crew setups, VFX shots need clean plates.

Return ONLY a valid JSON object with no additional text, no markdown code fences, no explanation. The response should start with { and end with }.

The JSON format:
{
  "shots": [
    {
      "sceneNumber": "1",
      "shotNumber": "1",
      "shotSize": "WS",
      "cameraAngle": "eye-level",
      "cameraMovement": "static",
      "lens": "24mm",
      "description": "Wide establishing shot of the kitchen. Sarah enters frame left, crosses to the counter.",
      "subjectOrFocus": "SARAH",
      "notes": "Establish geography for the rest of the scene"
    },
    {
      "sceneNumber": "1",
      "shotNumber": "2",
      "shotSize": "OTS",
      "cameraAngle": "eye-level",
      "cameraMovement": "static",
      "lens": "50mm",
      "description": "Over Sarah's shoulder onto Mike as he reads the letter. Hold on his reaction.",
      "subjectOrFocus": "MIKE",
      "notes": null
    }
  ]
}

Important:
- Generate shots for EVERY scene listed above, not just a sample
- Every shot's sceneNumber MUST exactly match one of the scene numbers provided
- Shot numbers should be unique within each scene
- Descriptions should be specific enough that a camera operator could frame the shot
- Return valid JSON only — no extra text before or after the object`;
}
