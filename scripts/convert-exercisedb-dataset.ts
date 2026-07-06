import path from "path";
import fs from "fs";

interface DatasetExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: { en?: string; zh?: string; [lang: string]: string | undefined };
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string | null;
}

// ---- Mapping tables (dataset value -> Prisma ExerciseAttributeValueEnum) ----

const EQUIPMENT_MAP: Record<string, string> = {
  "body weight": "BODY_ONLY",
  dumbbell: "DUMBBELL",
  barbell: "BARBELL",
  "olympic barbell": "BARBELL",
  "trap bar": "BARBELL",
  "ez barbell": "EZ_BAR",
  kettlebell: "KETTLEBELLS",
  cable: "CABLE",
  band: "BANDS",
  "resistance band": "BANDS",
  "medicine ball": "MEDICINE_BALL",
  "stability ball": "SWISS_BALL",
  "bosu ball": "BOSU",
  "smith machine": "SMITH_MACHINE",
  "leverage machine": "MACHINE",
  "sled machine": "SLED",
  rope: "ROPE",
  roller: "FOAM_ROLL",
  "wheel roller": "FOAM_ROLL",
  tire: "TYRE",
  weighted: "WEIGHT_PLATE",
  "assisted": "OTHER",
  hammer: "OTHER",
  "elliptical machine": "MACHINE",
  "stationary bike": "SPIN_BIKE",
  "stepmill machine": "STEP",
  "skierg machine": "SKIERG",
  "upper body ergometer": "MACHINE",
};

const TARGET_MUSCLE_MAP: Record<string, string> = {
  abs: "ABDOMINALS",
  pectorals: "CHEST",
  biceps: "BICEPS",
  triceps: "TRICEPS",
  glutes: "GLUTES",
  delts: "SHOULDERS",
  lats: "LATS",
  "upper back": "BACK",
  calves: "CALVES",
  quads: "QUADRICEPS",
  forearms: "FOREARMS",
  hamstrings: "HAMSTRINGS",
  traps: "TRAPS",
  abductors: "ABDUCTORS",
  adductors: "ADDUCTORS",
  spine: "BACK",
  "levator scapulae": "ROTATOR_CUFF",
  "serratus anterior": "ROTATOR_CUFF",
  "cardiovascular system": "",
};

// muscle_group / secondary_muscles values -> enum (broader aliases)
const MUSCLE_ALIAS_MAP: Record<string, string> = {
  ...TARGET_MUSCLE_MAP,
  "latissimus dorsi": "LATS",
  quadriceps: "QUADRICEPS",
  trapezius: "TRAPS",
  deltoids: "SHOULDERS",
  obliques: "OBLIQUES",
  "hip flexors": "HIP_FLEXOR",
  "lower back": "BACK",
  "rotator cuff": "ROTATOR_CUFF",
  abdominals: "ABDOMINALS",
  core: "ABDOMINALS",
  chest: "CHEST",
  back: "BACK",
  "rear deltoids": "SHOULDERS",
  rhomboids: "BACK",
  soleus: "CALVES",
  ankles: "ACHILLES_TENDON",
  "ankle stabilizers": "ACHILLES_TENDON",
  "wrist flexors": "FOREARMS",
  "wrist extensors": "FOREARMS",
  wrists: "FOREARMS",
  hands: "FINGERS",
  "upper chest": "CHEST",
  "lower abs": "ABDOMINALS",
  "inner thighs": "ADDUCTORS",
  groin: "GROIN",
  "brachialis": "BICEPS",
  "grip muscles": "FOREARMS",
  feet: "FINGERS",
  shins: "CALVES",
  "sternocleidomastoid": "NECK",
  "levator scapulae": "ROTATOR_CUFF",
  "serratus anterior": "ROTATOR_CUFF",
  "cardiovascular system": "",
  shoulders: "SHOULDERS",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toHtmlParagraphs(text: string): string {
  // dataset instructions are plain prose; wrap sentences into <p> blocks for parity with sample CSV
  const escaped = htmlEscape(text).trim();
  if (!escaped) return "";
  // split into ~2-sentence paragraphs for readability
  const sentences = escaped.split(/(?<=[.!?])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(`<p>${sentences.slice(i, i + 2).join(" ")}</p>`);
  }
  return paragraphs.join("");
}

// CSV field escaping (RFC 4180-ish)
function csvField(v: string): string {
  if (v == null) return "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, "\"\"")}"`;
  }
  return v;
}

function main() {
  const inputPath = process.argv[2] || path.join(process.cwd(), "data/exercises-dataset.json");
  const outputPath = process.argv[3] || path.join(process.cwd(), "data/exercises-import.csv");

  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const data: DatasetExercise[] = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(`Loaded ${data.length} exercises from dataset`);

  const header = [
    "id",
    "name",
    "name_en",
    "description",
    "description_en",
    "full_video_url",
    "full_video_image_url",
    "introduction",
    "introduction_en",
    "slug",
    "slug_en",
    "attribute_name",
    "attribute_value",
  ];

  const lines: string[] = [header.join(",")];

  let bodyweightCount = 0;
  let cardioCount = 0;
  let coreCount = 0;
  let muscleFallback = 0;
  let equipFallback = 0;
  const dupSlug = new Map<string, number>();

  for (const ex of data) {
    const nameEn = ex.name;
    const instructionsEn = ex.instructions?.en?.trim() || "";
    const instructionsZh = ex.instructions?.zh?.trim() || "";

    // use Chinese as primary "name"/"description" (French slot) when available, else English
    const descriptionEn = toHtmlParagraphs(instructionsEn);
    const description = instructionsZh ? toHtmlParagraphs(instructionsZh) : descriptionEn;

    // short introduction: first sentence
    const introEn = instructionsEn.split(/(?<=[.!?])\s+/)[0] || "";
    const introZh = instructionsZh.split(/[。！？]/)[0] || "";
    const introductionEn = introEn ? `<p>${htmlEscape(introEn)}</p>` : "";
    const introduction = introZh ? `<p>${htmlEscape(introZh)}</p>` : introductionEn;

    // media: dataset has only media_id; build CDN url for gif (rights may need check)
    const mediaId = ex.media_id || "";
    const fullVideoImageUrl = mediaId ? `https://static.exercisedb.dev/media/${mediaId}.gif` : "";
    const fullVideoUrl = mediaId ? `https://static.exercisedb.dev/media/${mediaId}.gif` : "";

    const baseSlug = slugify(nameEn) || `exercise-${ex.id}`;
    // ensure uniqueness across dataset (names could collide after slugify)
    let slug = baseSlug;
    if (dupSlug.has(slug)) {
      const n = dupSlug.get(slug)! + 1;
      dupSlug.set(slug, n);
      slug = `${baseSlug}-${n}`;
    } else {
      dupSlug.set(slug, 1);
    }

    const id = ex.id;
    const baseRow = [
      id,
      nameEn,
      nameEn,
      description,
      descriptionEn,
      fullVideoUrl,
      fullVideoImageUrl,
      introduction,
      introductionEn,
      slug,
      slug,
    ];

    const attrs: { name: string; value: string }[] = [];

    // TYPE
    const isCardio = ex.body_part === "cardio";
    const isBodyweight = ex.equipment === "body weight";
    let typeValue: string;
    if (isCardio) {
      typeValue = "CARDIO";
      cardioCount++;
    } else if (isBodyweight) {
      typeValue = "CALISTHENIC";
    } else {
      typeValue = "STRENGTH";
    }
    attrs.push({ name: "TYPE", value: typeValue });

    if (isBodyweight) bodyweightCount++;

    // EQUIPMENT
    let equipValue = EQUIPMENT_MAP[ex.equipment.toLowerCase().trim()];
    if (!equipValue) {
      equipValue = "OTHER";
      equipFallback++;
    }
    attrs.push({ name: "EQUIPMENT", value: equipValue });

    // PRIMARY_MUSCLE (from target)
    let primaryMuscle = TARGET_MUSCLE_MAP[ex.target.toLowerCase().trim()];
    if (primaryMuscle === undefined) {
      primaryMuscle = "NA";
      muscleFallback++;
    }
    if (primaryMuscle) {
      attrs.push({ name: "PRIMARY_MUSCLE", value: primaryMuscle });
    }

    // count core (waist body_part) for verification
    if (ex.body_part === "waist") coreCount++;

    // SECONDARY_MUSCLE (from secondary_muscles[] + muscle_group, deduped)
    const secondarySet = new Set<string>();
    for (const sm of ex.secondary_muscles || []) {
      const mapped = MUSCLE_ALIAS_MAP[sm.toLowerCase().trim()];
      if (mapped) secondarySet.add(mapped);
    }
    // also fold in muscle_group as a secondary if different from primary
    if (ex.muscle_group) {
      const mgMapped = MUSCLE_ALIAS_MAP[ex.muscle_group.toLowerCase().trim()];
      if (mgMapped && mgMapped !== primaryMuscle) secondarySet.add(mgMapped);
    }
    for (const sm of secondarySet) {
      if (sm) attrs.push({ name: "SECONDARY_MUSCLE", value: sm });
    }

    // emit one CSV row per attribute
    for (const a of attrs) {
      lines.push([...baseRow, a.name, a.value].map(csvField).join(","));
    }
  }

  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
  console.log(`\nWrote ${lines.length - 1} attribute rows for ${data.length} exercises -> ${outputPath}`);
  console.log(`Bodyweight (TYPE=CALISTHENIC): ${bodyweightCount}`);
  console.log(`Cardio (TYPE=CARDIO): ${cardioCount}`);
  console.log(`Core (body_part=waist): ${coreCount}`);
  console.log(`Muscle fallbacks (unmapped target -> NA): ${muscleFallback}`);
  console.log(`Equipment fallbacks (-> OTHER): ${equipFallback}`);
}

main();
