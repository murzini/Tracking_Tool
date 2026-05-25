import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { BASE_BACKPACKS } from "../../../lib/prototype/backpacks_meta";

// Helpers
const pad2 = (n) => String(n).padStart(2, "0");

function inferBaseIdFromVarFilename(filename) {
  // Supported:
  // - Var_18_1.jpg        -> Base_18
  // - Var_Base_18_1.png   -> Base_18
  const m1 = filename.match(/^Var_(\d{1,2})_(\d+)\.(png|jpg)$/i);
  if (m1) return `Base_${pad2(m1[1])}`;

  const m2 = filename.match(/^Var_(Base_\d{2})_(\d+)\.(png|jpg)$/i);
  if (m2) return m2[1];

  return null;
}

function inferVarLabel(filename, baseId) {
  // e.g., Var_18_1.jpg -> "Var 1"
  const m = filename.match(/_(\d+)\.(png|jpg)$/i);
  const idx = m ? Number(m[1]) : null;
  const baseNum = baseId?.match(/Base_(\d{2})/)?.[1] || "";
  if (idx != null) return `Base ${baseNum} - Var ${idx}`;
  return `Base ${baseNum} - Var`;
}

export async function GET() {
  // 1) Base models come from metadata (authoritative for filters)
  const baseModels = (BASE_BACKPACKS || []).filter((b) => {
    if (!b?.id) return false;
    if (b.isBase === true) return true;
    return String(b.id).startsWith("Base_");
  });

  const baseById = new Map(baseModels.map((b) => [b.id, b]));

  // 2) Variation images can be inferred from /public/backpacks at runtime
  //    (works locally without redeploy; in production you still need a redeploy to add files)
  const publicDir = path.join(process.cwd(), "public", "backpacks");
  let files = [];
  try {
    files = fs.readdirSync(publicDir);
  } catch {
    files = [];
  }

  const inferredVars = [];
  for (const file of files) {
    const baseId = inferBaseIdFromVarFilename(file);
    if (!baseId) continue;

    const base = baseById.get(baseId);
    if (!base) continue; // ignore vars for unknown bases

    inferredVars.push({
      id: `Var_${baseId}_${file}`, // stable unique id
      isBase: false,
      baseId,
      imageUrl: `/backpacks/${file}`,
      // inherit filter metadata from base
      audience: base.audience,
      purpose: base.purpose,
      material: base.material,
      color: base.color,
      priceBand: base.priceBand,
      price: base.price,
      model: base.model,
      description: base.description,
      _varLabel: inferVarLabel(file, baseId),
    });
  }

  // 3) Also include explicit variations written into backpacks_meta.js (optional)
  const explicitVars = (BASE_BACKPACKS || []).filter((b) => {
    if (!b?.id) return false;
    if (b.isBase === false) return true;
    return String(b.id).startsWith("Var_");
  }).map((v) => {
    // If baseId missing, infer from id like Var_18_1
    let baseId = v.baseId || null;
    if (!baseId) {
      const m = String(v.id).match(/^Var_(\d{1,2})_/i);
      if (m) baseId = `Base_${pad2(m[1])}`;
    }
    return { ...v, isBase: false, baseId };
  });

  // De-dup vars by imageUrl (preferred) or id.
  // IMPORTANT: explicit variations defined in backpacks_meta.js must WIN over
  // inferred ones from filesystem scan, because explicit ones may override
  // inherited metadata (e.g., audience "Woman" for a base that is "Man").
  const varByKey = new Map();

  // 1) Add inferred first (lowest priority)
  for (const v of inferredVars) {
    const key = v.imageUrl || v.id;
    if (!key) continue;
    varByKey.set(key, v);
  }

  // 2) Add explicit last (highest priority)
  for (const v of explicitVars) {
    const key = v.imageUrl || v.id;
    if (!key) continue;
    varByKey.set(key, v);
  }

  const variations = Array.from(varByKey.values());

  // 4) Convert to UI catalog items (keeps existing UI expectations)
  //    - numeric id + sku for display
  //    - baseId always points to Base_XX, used for details thumbnails
  const items = [];
  let idx = 1;

  for (const b of baseModels) {
    const sku = String(idx).padStart(3, "0");
    items.push({
      id: idx,
      sku,
      name: `AdventureBag ${sku}`,
      subtitle: b.model,
      isBase: true,
      baseId: b.id,
      imageUrl: b.imageUrl,
      price: b.price,
      audience: b.audience,
      purpose: b.purpose,
      material: b.material,
      color: b.color,
      priceBand: b.priceBand,
      description: b.description,
    });
    idx += 1;
  }

  for (const v of variations) {
    const base = baseById.get(v.baseId);
    if (!base) continue;
    const sku = String(idx).padStart(3, "0");
    items.push({
      id: idx,
      sku,
      name: `AdventureBag ${sku}`,
      subtitle: v.name || v.model || v._varLabel || base.model,
      isBase: false,
      baseId: v.baseId,
      imageUrl: v.imageUrl, // variation hero
      price: v.price ?? base.price,
      audience: v.audience ?? base.audience,
      purpose: v.purpose ?? base.purpose,
      material: v.material ?? base.material,
      color: v.color ?? base.color,
      priceBand: v.priceBand ?? base.priceBand,
      description: v.description ?? base.description,
    });
    idx += 1;
  }

  return NextResponse.json({ items });
}
