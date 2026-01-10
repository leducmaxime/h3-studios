import { ScrollUp } from "@/components/common/ScrollUp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const equipmentData = [
  {
    category: "Batterie",
    laScene: "YAMAHA recording 9000 6 fûts (caisse claire Premier série pro XPK)",
    lePodium: "Pearl DLX pro 6 fûts (Cymbale ride + Charlé Sabian)",
  },
  {
    category: "Amplificateurs - Basse",
    laScene: "Trace Eliot GP7 SM 250w (rms) + Boomer Fender 300w (rms)",
    lePodium: "AMPEQ Rocket bass RB210 500w",
  },
  {
    category: "Amplificateurs - Guitare",
    laScene:
      "Marshall Valvestate VS 265, Fender performer 1000, Laney GC 120c, Marshall acoustic AS 50D, Hugues & Kettner Warp 7",
    lePodium:
      "Marshall Valvestate 80V, Fender Superamp, Roland acoustic Chorus AC-60, Vox DA5",
  },
  {
    category: "Sonorisation - Table mixage / effets",
    laScene:
      "Mackie SR 24.4, Compresseur Boss CL-50, Reverb TC Electronic M-2000, EQ Alesis M-EQ230",
    lePodium: "YAMAHA EMX 2000 effets intégrés",
  },
  {
    category: "Sonorisation - Amplification",
    laScene:
      "Dynacord L2800 FD, Montarbo 402, Enceintes DAS 2x400w, caisson basse 2x500w",
    lePodium:
      "Dynacord PAA 300, Bose 802 série II / DAS / Ross (2x450w en tout), caisson 502B",
  },
  {
    category: "Retours",
    laScene:
      "Ampli ROSS méga Amp 800, Enceintes DAS 2x300w, Laney amplifiés 2x200w",
    lePodium: "Ampli aeq 301, Enceintes ROSS",
  },
];

const recordingEquipment = [
  {
    category: "Chant",
    equipment: "SHURE SM58 x 2 / SM58 beta x 3\nSennheiser MD 425 / BF811 x2",
  },
  {
    category: "Batterie",
    equipment:
      "AKG D112 (x2)\nSennheiser e 602\nSM 57\nFûts e604 ; Blackfire 504 / 604 / 521 (x3) / 521 II (x3)\nOverhead Sennheiser (x2) ; Shure SM 81",
  },
  {
    category: "Basse / Guitare",
    equipment: "AKG D112\nSennheiser e609 (x2)",
  },
  {
    category: "Cartes sons",
    equipment: "Focusrite Scarlett 20 pistes",
  },
  {
    category: "Logiciels",
    equipment: "Reaper\nFL Studio",
  },
];

const rentalInstruments = [
  {
    category: "Basses / Guitares",
    equipment: "TUNE 5 cordes\nEagle / Greg Bi",
  },
  {
    category: "Claviers numériques",
    equipment: "Roland RD-300 SX / Ensoniq VFX / Korg M1",
  },
  {
    category: "Percussions / Cymbales",
    equipment:
      "Cajon SELA / Darbouka Meinl\nIstanbul agop (16'' + 18'') / ZILDJIAN Série K (18'') / Meinl Rakes (14'') / TOSCO (18'') / Paiste 402-502 / ZILDJIAN Flashsplash (8'')",
  },
  {
    category: "Pédale & numérique",
    equipment: "V-AMP 2 Behringer\nNative machine+ et M32",
  },
];

export function LeMateriel() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="flex w-full flex-col gap-16 text-center">
        <div className="font-blanka text-3xl md:text-5xl">LE MATERIEL</div>

        <div className="flex flex-col gap-8">
          <div className="text-center font-blanka text-2xl">
            EQUIPEMENT DES STUDIOS
          </div>

          <div className="hidden lg:block">
            <Table className="border-8 border-primary">
              <TableHeader>
                <TableRow className="border-primary">
                  <TableHead></TableHead>
                  <TableHead>Studio La Scène</TableHead>
                  <TableHead>Studio Le Podium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell>{item.laScene}</TableCell>
                    <TableCell>{item.lePodium}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-8 lg:hidden">
            <Table className="border-8 border-primary">
              <TableHeader>
                <TableRow className="border-primary">
                  <TableHead colSpan={2} className="text-center">
                    Studio La Scène
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell>{item.laScene}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Table className="border-8 border-primary">
              <TableHeader>
                <TableRow className="border-primary">
                  <TableHead colSpan={2} className="text-center">
                    Studio Le Podium
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell>{item.lePodium}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-8 xl:flex-row">
          <div className="flex flex-col gap-8 xl:basis-1/2">
            <div className="text-center font-blanka text-2xl">
              EQUIPEMENT D'ENREGISTREMENT
            </div>
            <Table className="border-8 border-primary">
              <TableBody>
                {recordingEquipment.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell className="whitespace-pre-line">
                      {item.equipment}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-8 xl:basis-1/2">
            <div className="text-center font-blanka text-2xl">
              LOCATION D'INSTRUMENTS
            </div>
            <Table className="border-8 border-primary">
              <TableBody>
                {rentalInstruments.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell className="whitespace-pre-line">
                      {item.equipment}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
