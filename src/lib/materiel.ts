export type MaterielIconKey =
  | "drum"
  | "guitar"
  | "volume2"
  | "mic2"
  | "headphones"
  | "laptop"
  | "music"
  | "piano"
  | "component"
  | "cpu"
  | "radio";

export type MaterielStudioKey = "laScene" | "lePodium";

export interface MaterielItem {
  id: string;
  icon: MaterielIconKey;
  category: string;
  equipment: string;
}

export interface MaterielListItem {
  id: string;
  icon: MaterielIconKey;
  category: string;
  equipment: string[];
}

export interface MaterielStudioSection {
  name: string;
  size: string;
  items: MaterielItem[];
}

export interface MaterielData {
  studios: Record<MaterielStudioKey, MaterielStudioSection>;
  recording: MaterielListItem[];
  rental: MaterielListItem[];
}

export const DEFAULT_MATERIEL: MaterielData = {
  studios: {
    laScene: {
      name: "La Scène",
      size: "42m²",
      items: [
        {
          id: "la-scene-batterie",
          icon: "drum",
          category: "Batterie",
          equipment: "YAMAHA recording 9000 6 fûts (caisse claire Premier série pro XPK)",
        },
        {
          id: "la-scene-amplis-basse",
          icon: "guitar",
          category: "Amplis Basse",
          equipment: "Trace Eliot GP7 SM 250w (rms) + Boomer Fender 300w (rms)",
        },
        {
          id: "la-scene-amplis-guitare",
          icon: "radio",
          category: "Amplis Guitare",
          equipment: "Marshall Valvestate VS 265, Fender performer 1000, Laney GC 120c, Marshall acoustic AS 50D, Hugues & Kettner Warp 7",
        },
        {
          id: "la-scene-mixage",
          icon: "volume2",
          category: "Table de mixage",
          equipment: "Mackie SR 24.4, Compresseur Boss CL-50, Reverb TC Electronic M-2000, EQ Alesis M-EQ230",
        },
        {
          id: "la-scene-amplification",
          icon: "headphones",
          category: "Amplification",
          equipment: "Dynacord L2800 FD, Montarbo 402, Enceintes DAS 2x400w, caisson basse 2x500w",
        },
        {
          id: "la-scene-retours",
          icon: "mic2",
          category: "Retours",
          equipment: "Ampli ROSS méga Amp 800, Enceintes DAS 2x300w, Laney amplifiés 2x200w",
        },
      ],
    },
    lePodium: {
      name: "Le Podium",
      size: "35m²",
      items: [
        {
          id: "le-podium-batterie",
          icon: "drum",
          category: "Batterie",
          equipment: "Pearl DLX pro 6 fûts (Cymbale ride + Charlé Sabian)",
        },
        {
          id: "le-podium-amplis-basse",
          icon: "guitar",
          category: "Amplis Basse",
          equipment: "AMPEQ Rocket bass RB210 500w",
        },
        {
          id: "le-podium-amplis-guitare",
          icon: "radio",
          category: "Amplis Guitare",
          equipment: "Marshall Valvestate 80V, Fender Superamp, Roland acoustic Chorus AC-60, Vox DA5",
        },
        {
          id: "le-podium-mixage",
          icon: "volume2",
          category: "Table de mixage",
          equipment: "YAMAHA EMX 2000 effets intégrés",
        },
        {
          id: "le-podium-amplification",
          icon: "headphones",
          category: "Amplification",
          equipment: "Dynacord PAA 300, Bose 802 série II / DAS / Ross (2x450w en tout), caisson 502B",
        },
        {
          id: "le-podium-retours",
          icon: "mic2",
          category: "Retours",
          equipment: "Ampli aeq 301, Enceintes ROSS",
        },
      ],
    },
  },
  recording: [
    {
      id: "recording-micros-chant",
      icon: "mic2",
      category: "Micros Chant",
      equipment: ["SHURE SM58 x 2", "SM58 beta x 3", "Sennheiser MD 425", "BF811 x2"],
    },
    {
      id: "recording-micros-batterie",
      icon: "drum",
      category: "Micros Batterie",
      equipment: [
        "AKG D112 x2",
        "Sennheiser e 602",
        "SM 57",
        "Fûts e604, Blackfire 504/604/521 x3",
        "Overhead Sennheiser x2, Shure SM 81",
      ],
    },
    {
      id: "recording-micros-instruments",
      icon: "guitar",
      category: "Micros Instruments",
      equipment: ["AKG D112", "Sennheiser e609 x2"],
    },
    {
      id: "recording-carte-son",
      icon: "cpu",
      category: "Carte son",
      equipment: ["Focusrite Scarlett 20 pistes"],
    },
    {
      id: "recording-logiciels",
      icon: "laptop",
      category: "Logiciels",
      equipment: ["Reaper", "FL Studio"],
    },
  ],
  rental: [
    {
      id: "rental-basses-guitares",
      icon: "guitar",
      category: "Basses / Guitares",
      equipment: ["TUNE 5 cordes", "Eagle", "Greg Bi"],
    },
    {
      id: "rental-claviers",
      icon: "piano",
      category: "Claviers",
      equipment: ["Roland RD-300 SX", "Ensoniq VFX", "Korg M1"],
    },
    {
      id: "rental-percussions",
      icon: "component",
      category: "Percussions",
      equipment: ["Cajon SELA", "Darbouka Meinl"],
    },
    {
      id: "rental-cymbales",
      icon: "music",
      category: "Cymbales",
      equipment: [
        "Istanbul agop 16'' + 18''",
        "ZILDJIAN Série K 18''",
        "Meinl Rakes 14''",
        "TOSCO 18''",
        "ZILDJIAN Flashsplash 8''",
      ],
    },
    {
      id: "rental-effets-numerique",
      icon: "cpu",
      category: "Effets & Numérique",
      equipment: ["V-AMP 2 Behringer", "Native machine+ et M32"],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string")) return null;
  return value;
}

function asIconKey(value: unknown): MaterielIconKey | null {
  const v = asString(value);
  if (!v) return null;
  const keys: MaterielIconKey[] = [
    "drum",
    "guitar",
    "volume2",
    "mic2",
    "headphones",
    "laptop",
    "music",
    "piano",
    "component",
    "cpu",
    "radio",
  ];
  return (keys as string[]).includes(v) ? (v as MaterielIconKey) : null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeItem(raw: unknown): MaterielItem | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const icon = asIconKey(raw.icon);
  const category = asString(raw.category);
  const equipment = asString(raw.equipment);
  if (!icon || !category || !equipment) return null;

  const normalized: MaterielItem = {
    id: id && id.trim() ? id : crypto.randomUUID(),
    icon,
    category: normalizeText(category),
    equipment: normalizeText(equipment),
  };
  if (!normalized.category || !normalized.equipment) return null;
  return normalized;
}

function normalizeListItem(raw: unknown): MaterielListItem | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const icon = asIconKey(raw.icon);
  const category = asString(raw.category);
  const equipment = asStringArray(raw.equipment);
  if (!icon || !category || !equipment) return null;

  const list = equipment
    .map((s) => normalizeText(s))
    .filter(Boolean);

  const normalized: MaterielListItem = {
    id: id && id.trim() ? id : crypto.randomUUID(),
    icon,
    category: normalizeText(category),
    equipment: list,
  };
  if (!normalized.category) return null;
  return normalized;
}

function normalizeStudioSection(raw: unknown): MaterielStudioSection | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const size = asString(raw.size);
  const itemsRaw = Array.isArray(raw.items) ? raw.items : null;
  if (!name || !size || !itemsRaw) return null;

  const items: MaterielItem[] = [];
  for (const it of itemsRaw) {
    const parsed = normalizeItem(it);
    if (!parsed) return null;
    items.push(parsed);
  }

  const normalized: MaterielStudioSection = {
    name: normalizeText(name),
    size: normalizeText(size),
    items,
  };
  if (!normalized.name || !normalized.size) return null;
  return normalized;
}

export function parseMaterielSetting(raw: string | null): MaterielData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const studiosRaw = isRecord(parsed.studios) ? parsed.studios : null;
    const recordingRaw = Array.isArray(parsed.recording) ? parsed.recording : null;
    const rentalRaw = Array.isArray(parsed.rental) ? parsed.rental : null;
    if (!studiosRaw || !recordingRaw || !rentalRaw) return null;

    const laScene = normalizeStudioSection(studiosRaw.laScene);
    const lePodium = normalizeStudioSection(studiosRaw.lePodium);
    if (!laScene || !lePodium) return null;

    const recording: MaterielListItem[] = [];
    for (const it of recordingRaw) {
      const parsedItem = normalizeListItem(it);
      if (!parsedItem) return null;
      recording.push(parsedItem);
    }

    const rental: MaterielListItem[] = [];
    for (const it of rentalRaw) {
      const parsedItem = normalizeListItem(it);
      if (!parsedItem) return null;
      rental.push(parsedItem);
    }

    return {
      studios: { laScene, lePodium },
      recording,
      rental,
    };
  } catch {
    return null;
  }
}
