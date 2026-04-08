export type ShotlistProfile = {
  id: string;
  name: string;
  description: string;
  /** Guidance included in the AI prompt to shape shot selection */
  promptGuidance: string;
};

export const SHOTLIST_PROFILES: ShotlistProfile[] = [
  {
    id: "standard",
    name: "Standard Coverage",
    description: "Traditional master-medium-closeup coverage. Safe and thorough.",
    promptGuidance: `Use classic coverage for each scene:
- Start with a wide/master shot establishing the space and blocking
- Add medium shots for key interactions and transitions
- Include close-ups on principal characters during important dialogue or reactions
- Add inserts for important props, actions, or details the audience needs to see
- For dialogue scenes, include over-the-shoulder shots for each speaker
- Aim for 5-8 shots per scene depending on complexity`
  },
  {
    id: "minimal",
    name: "Minimal / Indie",
    description: "Few setups, naturalistic. Handheld and observational.",
    promptGuidance: `Keep setups minimal — this is a lean indie production:
- Favor longer takes and wider compositions that capture the full scene
- Use handheld or natural camera movement over locked-off tripod work
- Limit to 2-4 shots per scene — only cut when it genuinely serves the story
- Prefer two-shots and medium wides over coverage-heavy singles
- Avoid complex camera moves or multiple angles of the same moment
- Let actors' performances carry the scene rather than editing`
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Deliberate compositions, motivated camera moves, specific lensing.",
    promptGuidance: `Design each shot as a deliberate visual composition:
- Suggest specific lens choices (e.g., 35mm, 50mm, 85mm) for each shot
- Include motivated camera movements — dollies, cranes, Steadicam moves with clear purpose
- Plan for depth-of-field control: suggest shallow DOF for intimacy, deep DOF for environment
- Consider shot transitions — how one shot leads into the next
- Include establishing shots with atmosphere and production value
- Aim for 6-12 shots per scene, each one intentional and visually distinct`
  },
  {
    id: "dialogue",
    name: "Dialogue-Focused",
    description: "Optimized for conversation scenes. OTS, singles, reactions.",
    promptGuidance: `Optimize coverage for dialogue-driven scenes:
- Start with a two-shot or wide establishing the spatial relationship between speakers
- Include matching over-the-shoulder shots for each speaker
- Add clean singles (no foreground shoulder) for emotionally important lines
- Plan reaction shots — the listener's face is often more important than the speaker's
- Include a "dirty" single or profile shot as a transitional angle
- For group conversations, plan how coverage handles three or more people
- Aim for 4-7 shots per scene, ensuring complete editorial coverage of the conversation`
  },
  {
    id: "action",
    name: "Action / Dynamic",
    description: "High energy. Tracking shots, POVs, rapid coverage for physical scenes.",
    promptGuidance: `Design coverage for energy, movement, and editorial pace:
- Include tracking shots that follow character movement through the space
- Add POV shots to put the audience in the character's perspective
- Plan for rapid cutting — multiple angles of the same action for editorial options
- Include wide shots that establish geography so the audience stays oriented
- Suggest handheld for chaos and energy, locked-off for contrast and tension
- For stunts or physical action, plan safety angles and wide coverage for continuity
- Include insert shots of hands, feet, impacts, and environmental details
- Aim for 8-15 shots per scene, with emphasis on coverage and options`
  }
];

export function getProfileById(id: string): ShotlistProfile | undefined {
  return SHOTLIST_PROFILES.find((p) => p.id === id);
}
