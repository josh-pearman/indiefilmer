/**
 * Generates a single HTML document that color-codes scenes by filming location.
 * Uses the same 20-color palette as the docs/color-coded-script-by-location guide.
 * Output is viewable in browser and printable to PDF (enable "Background graphics").
 */

export const LOCATION_PALETTE: readonly string[] = [
  "#D0E8FF", "#FFD6E0", "#FFF8D0", "#D0F0D8", "#E8D8F0",
  "#FFE0D0", "#D0F0E8", "#FFE8D0", "#D0F0F0", "#F0E8C8",
  "#F0D0D8", "#D8E8D0", "#D8E8F8", "#F0E0C0", "#E0E0E0",
  "#E0D0F0", "#F8F0D0", "#D0E8E8", "#F8D8D8", "#F0E8D8"
] as const;

const FALLBACK_COLOR = "#FFFFFF";

export type SceneForColorScript = {
  sceneNumber: string;
  locationName: string | null;
  slugline: string;
  synopsis: string | null;
};

export type ColorCodedScriptInput = {
  title: string;
  date: string;
  scenes: SceneForColorScript[];
  locationToHex: Record<string, string>;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildColorCodedScriptHtml(input: ColorCodedScriptInput): string {
  const { title, date, scenes, locationToHex } = input;
  const locationNames = [...new Set(Object.keys(locationToHex))];
  const hasUnassigned = scenes.some((s) => !s.locationName);

  const legendRows = locationNames
    .map(
      (name) =>
        `    <tr class="legend-row" data-location="${escapeAttr(name)}" role="button" tabindex="0" title="Click to filter by this location"><td style="background:${locationToHex[name]}; width:24px; height:18px; border:1px solid #ccc;"></td><td>${escapeHtml(name)}</td></tr>`
    )
    .join("\n");
  const unassignedRow = hasUnassigned
    ? `\n    <tr class="legend-row" data-location="_unassigned" role="button" tabindex="0" title="Click to filter to unassigned scenes"><td style="background:${FALLBACK_COLOR}; width:24px; height:18px; border:1px solid #ccc;"></td><td>Unassigned</td></tr>`
    : "";

  const sceneBlocks = scenes
    .map((scene) => {
      const hex = scene.locationName
        ? (locationToHex[scene.locationName] ?? FALLBACK_COLOR)
        : FALLBACK_COLOR;
      const locationKey = scene.locationName ?? "_unassigned";
      const synopsisHtml = scene.synopsis
        ? `\n    <p class="synopsis">${escapeHtml(scene.synopsis)}</p>`
        : "";
      return `  <div class="scene-block" data-location="${escapeAttr(locationKey)}" style="background-color:${hex};">
    <p class="slugline"><strong>${escapeHtml(scene.sceneNumber)}.</strong> ${escapeHtml(scene.slugline)}</p>${synopsisHtml}
  </div>`;
    })
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — Color-coded by location</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 12pt;
      line-height: 1.4;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
      color: #111;
    }
    .title-block { margin-bottom: 1.5em; }
    .title-block h1 { font-size: 1.5em; margin: 0 0 0.25em 0; }
    .title-block .date { color: #555; font-size: 0.95em; }
    .legend {
      margin-bottom: 2em;
      padding: 0.75em;
      border: 1px solid #ccc;
      background: #fafafa;
    }
    .legend h2 { font-size: 1em; margin: 0 0 0.5em 0; }
    .legend table { border-collapse: collapse; }
    .legend td { padding: 2px 10px 2px 0; vertical-align: middle; }
    .legend-row { cursor: pointer; user-select: none; }
    .legend-row:hover { background: #eee; }
    .legend-row.active { background: #ddd; font-weight: bold; }
    .legend-hint { font-weight: normal; color: #666; font-size: 0.9em; }
    .legend-actions { margin-top: 0.5em; }
    .legend-actions .show-all { font-size: 0.9em; color: #0066cc; cursor: pointer; text-decoration: underline; }
    .legend-actions .show-all:hover { color: #004499; }
    .scene-block.filtered-out { display: none; }
    .scene-block {
      padding: 0.75em 1em;
      margin-bottom: 0;
      border-bottom: 1px solid rgba(0,0,0,0.15);
      page-break-inside: avoid;
    }
    .scene-block .slugline { margin: 0 0 0.25em 0; }
    .scene-block .synopsis {
      margin: 0;
      font-size: 0.9em;
      color: #333;
      padding-left: 2em;
    }
    @media print {
      body { padding: 0.5in; }
      .scene-block { page-break-inside: avoid; }
      .legend-row { cursor: default; }
      .legend-actions { display: none; }
      .legend-hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="title-block">
    <h1>${escapeHtml(title)}</h1>
    <p class="date">${escapeHtml(date)} — Color-coded by location</p>
  </div>

  <div class="legend">
    <h2>Location legend <span class="legend-hint">(click to filter)</span></h2>
    <table>
${legendRows}${unassignedRow}
    </table>
    <div class="legend-actions" id="legend-actions" style="display:none;">
      <span class="show-all" id="show-all" role="button" tabindex="0">Show all locations</span>
    </div>
  </div>

${sceneBlocks}

<script>
(function() {
  var currentFilter = null;
  var blocks = document.querySelectorAll('.scene-block');
  var rows = document.querySelectorAll('.legend-row');
  var actions = document.getElementById('legend-actions');
  var showAll = document.getElementById('show-all');

  function setFilter(location) {
    currentFilter = location;
    rows.forEach(function(row) {
      row.classList.toggle('active', row.getAttribute('data-location') === location);
    });
    blocks.forEach(function(block) {
      var match = !location || block.getAttribute('data-location') === location;
      block.classList.toggle('filtered-out', !match);
    });
    actions.style.display = location ? 'block' : 'none';
  }

  rows.forEach(function(row) {
    function apply() {
      var loc = row.getAttribute('data-location');
      setFilter(currentFilter === loc ? null : loc);
    }
    row.addEventListener('click', apply);
    row.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(); }
    });
  });

  showAll.addEventListener('click', function() { setFilter(null); });
  showAll.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(null); }
  });
})();
</script>
</body>
</html>`;
}

/**
 * Build location → hex map from ordered scene list: first appearance gets first color.
 */
export function buildLocationToHex(
  scenes: { locationName: string | null }[],
  palette: readonly string[] = LOCATION_PALETTE
): Record<string, string> {
  const map: Record<string, string> = {};
  let index = 0;
  for (const scene of scenes) {
    const name = scene.locationName?.trim();
    if (!name || name in map) continue;
    map[name] = palette[index] ?? FALLBACK_COLOR;
    index++;
  }
  return map;
}
