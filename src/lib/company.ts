/** Single source of truth for legal identity, contact, and geo. */

export const COMPANY = {
  legalName: "H3 STUDIOS",
  brandName: "H3 Studios",
  legalForm: "SAS",
  legalFormLong: "société par actions simplifiée",
  siren: "944 221 753",
  siret: "944 221 753 00014",
  vatNumber: "FR73 944 221 753",
  shareCapital: "500,00 €",
  rcsCity: "Créteil",
  publicationDirector: "Marcel Hamon",
  address: {
    street: "3 Rue de la Grande Ceinture",
    postalCode: "94370",
    city: "Sucy-en-Brie",
    country: "FR",
  },
  phoneDisplay: "06 13 44 08 75",
  phoneTel: "+33613440875",
  email: "contact@h3-studios.fr",
  siteUrl: "https://h3-studios.fr",
  siteHost: "h3-studios.fr",
  geo: {
    latitude: 48.7705935,
    longitude: 2.5056598,
  },
} as const;

export const HOSTING = {
  name: "Cloudflare, Inc.",
  address: "101 Townsend Street, San Francisco, CA 94107, États-Unis",
  phone: "+1 (650) 319-8930",
} as const;

export const LEGAL_UPDATED_AT = "20 août 2026";
export const LEGAL_UPDATED_ISO = "2026-08-20";

export function companyFullAddress(): string {
  return `${COMPANY.address.street}, ${COMPANY.address.postalCode} ${COMPANY.address.city}`;
}

export function companyRcs(): string {
  return `${COMPANY.siren} R.C.S. ${COMPANY.rcsCity}`;
}
