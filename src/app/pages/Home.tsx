import { ScrollUp } from "@/components/common/ScrollUp";

const services = [
  "Location de studios",
  "Repetitions",
  "Enregistrements",
  "Location de materiel",
  "Cours de Batterie",
  "Privatisation",
  "Ateliers d'arrangements musicaux",
];

export function Home() {
  return (
    <div className="mx-4 flex min-h-fit grow flex-col items-center justify-between pb-8 pt-12">
      <div className="basis-1/3"></div>
      <div className="flex h-full flex-col items-center justify-between gap-8">
        <ScrollUp />
        <img
          src="/images/home/1.png"
          alt="H3 Studios"
          className="lg:-mb-16 lg:w-[750px]"
        />
        <img
          src="/images/home/2.png"
          alt="Répétitions - Enregistrements"
          className="lg:w-[650px]"
        />
        <div className="text-center font-blanka text-lg md:text-2xl">
          {services.map((text, i) => (
            <span key={i}>
              <span className="whitespace-nowrap">
                {text}
                {i !== services.length - 1 ? " -" : ""}
              </span>{" "}
            </span>
          ))}
        </div>
        <a href="/reservation">
          <button className="rounded-[3rem] bg-primary px-12 py-4 text-xl font-bold text-black md:text-2xl">
            Réservation
          </button>
        </a>
      </div>
      <div className="basis-2/3"></div>
    </div>
  );
}
