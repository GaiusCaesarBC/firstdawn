import { normalizeAtlasSnapshotHumanAppearances, type AtlasSnapshot } from "../worlds/map-atlas";
import { prisma } from "../worlds/world-lifecycle";

type PersistedLightweightAtlasSnapshot = {
  selectedDay: number;
  snapshot: AtlasSnapshot;
};

export async function getLatestPersistedLightweightAtlasSnapshot(
  worldId: string,
): Promise<PersistedLightweightAtlasSnapshot | null> {
  const rows = await prisma.$queryRaw<Array<{ selectedDay: number | null; snapshot: unknown }>>`
    WITH latest AS (
      SELECT
        st."metadata"->'atlasSnapshot' AS envelope
      FROM "SimulationTick" st
      WHERE st."worldId" = ${worldId}
        AND jsonb_exists(st."metadata", 'atlasSnapshot')
      ORDER BY st."tick" DESC, st."completedAt" DESC
      LIMIT 1
    ),
    lightweight_cells AS (
      SELECT
        jsonb_agg(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        cell.value,
                        '{animalPopulations}',
                        '[]'::jsonb,
                        true
                      ),
                      '{movementVectors}',
                      '[]'::jsonb,
                      true
                    ),
                    '{ecosystemHistory}',
                    '[]'::jsonb,
                    true
                  ),
                  '{plantPopulations}',
                  '[]'::jsonb,
                  true
                ),
                '{adaptationSignals}',
                '[]'::jsonb,
                true
              ),
              '{resourceDeposits}',
              '[]'::jsonb,
              true
            ),
            '{civilizationMarkers}',
            '[]'::jsonb,
            true
          )
          ORDER BY cell.ordinality
        ) AS cells
      FROM latest
      CROSS JOIN LATERAL jsonb_array_elements(latest.envelope->'snapshot'->'cells')
        WITH ORDINALITY AS cell(value, ordinality)
    )
    SELECT
      COALESCE((latest.envelope->>'selectedDay')::int, 0) AS "selectedDay",
      jsonb_set(
        latest.envelope->'snapshot',
        '{cells}',
        COALESCE(lightweight_cells.cells, '[]'::jsonb),
        false
      ) AS "snapshot"
    FROM latest
    CROSS JOIN lightweight_cells
  `;

  const row = rows[0];

  if (!row?.snapshot) {
    return null;
  }

  return {
    selectedDay: row.selectedDay ?? 0,
    snapshot: normalizeAtlasSnapshotHumanAppearances(row.snapshot as AtlasSnapshot),
  };
}
