import { ScrollUp } from "@/components/common/ScrollUp";

const services = [
  ["Location de studios", "Répétitions"],
  ["Enregistrements", "Privatisation"],
];

export function Home() {
  return (
    <div className="mx-4 flex min-h-fit grow flex-col items-center justify-center pb-8 pt-32">
      <div className="flex h-full flex-col items-center justify-center gap-8">
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
          {services.map((row, i) => (
            <div key={i} className="flex flex-wrap justify-center gap-x-4 gap-y-0">
              {row.map((text, j) => (
                <span key={j}>
                  <span className="whitespace-nowrap">
                    {text}
                    {!(i === services.length - 1 && j === row.length - 1) ? " -" : ""}
                  </span>{" "}
                </span>
              ))}
            </div>
          ))}
        </div>
        <a href="/reservation">
          <button className="rounded-[3rem] bg-primary px-12 py-4 text-xl font-bold text-black md:text-2xl">
            Réservation
          </button>
        </a>
      </div>
    </div>
  );
}
