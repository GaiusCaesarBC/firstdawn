const world = "local-sandbox";

async function main() {
  const url = `http://localhost:3000/api/worlds/map?world=${encodeURIComponent(world)}`;
  const started = Date.now();

  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  const elapsed = Date.now() - started;
  const bytes = Buffer.byteLength(text, "utf8");

  console.log("STATUS:", response.status);
  console.log("OK:", response.ok);
  console.log("MS:", elapsed);
  console.log("CONTENT-TYPE:", response.headers.get("content-type"));
  console.log("BYTES:", bytes);
  console.log("MB:", (bytes / 1024 / 1024).toFixed(2));
  console.log("BODY PREVIEW:");
  console.log(text.slice(0, 1000) || "[empty body]");

  if (!response.ok || !text.trim()) {
    return;
  }

  const parsed = JSON.parse(text);

  console.log("TOP LEVEL KEYS:", Object.keys(parsed).sort());
  console.log("TICK:", parsed.tick?.toString?.() ?? parsed.tick);
  console.log("CELLS:", Array.isArray(parsed.cells) ? parsed.cells.length : "missing");

  const firstCell = parsed.cells?.[0];
  console.log("FIRST CELL SAMPLE:", {
    id: firstCell?.id,
    row: firstCell?.row,
    column: firstCell?.column,
    terrainType: firstCell?.terrainType,
    biomeKey: firstCell?.biomeKey,
    biomeName: firstCell?.biomeName,
    animalPopulations: Array.isArray(firstCell?.animalPopulations) ? firstCell.animalPopulations.length : null,
    ecosystemHistory: Array.isArray(firstCell?.ecosystemHistory) ? firstCell.ecosystemHistory.length : null,
    movementVectors: Array.isArray(firstCell?.movementVectors) ? firstCell.movementVectors.length : null,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
