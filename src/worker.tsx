import { render, route, layout, prefix } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { MainLayout } from "@/app/layouts/MainLayout";
import { Home } from "@/app/pages/Home";
import { LesStudios } from "@/app/pages/LesStudios";
import { LeMateriel } from "@/app/pages/LeMateriel";
import { Tarifs } from "@/app/pages/Tarifs";
import { Reservation } from "@/app/pages/Reservation";
import { APropos } from "@/app/pages/APropos";
import { generateSitemap, generateRobotsTxt } from "@/app/seo";

export type AppContext = {};

const DocumentWithPath = ({ children, path }: { children: React.ReactNode; path: string }) => (
  <Document path={path}>{children}</Document>
);

export default defineApp([
  setCommonHeaders(),
  
  route("/sitemap.xml", () => {
    return new Response(generateSitemap(), {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }),
  
  route("/robots.txt", () => {
    return new Response(generateRobotsTxt(), {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }),

  render(({ children }) => <DocumentWithPath path="/">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/", Home),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/les-studios">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/les-studios", LesStudios),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/le-materiel">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/le-materiel", LeMateriel),
    ]),
  ]),

  route("/tarifs-et-reservation", () => {
    return new Response(null, {
      status: 301,
      headers: { Location: "/tarifs" },
    });
  }),

  render(({ children }) => <DocumentWithPath path="/tarifs">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/tarifs", Tarifs),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/reservation">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/reservation", () => <Reservation />),
      route("/reservation/:step", ({ params }) => <Reservation step={params.step} />),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/a-propos">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/a-propos", APropos),
    ]),
  ]),
]);
