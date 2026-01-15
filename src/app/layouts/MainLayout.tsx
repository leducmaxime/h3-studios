import { Header } from "@/components/Header/Header";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <Header />
      <div className="container flex h-full flex-col justify-between">
        {children}
      </div>
    </>
  );
}
