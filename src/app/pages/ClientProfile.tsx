"use client";

import { useState, useEffect, useRef } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock, Phone, Music, MapPin, Building2, Hash, Home, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { refresh, useClientAuth } from "@/lib/client-auth-store";
import { getVisibleBookingFields, isValidRna, isValidSiret } from "@/lib/booking-fields";
import type { ClientType } from "@/lib/booking-fields";

function RequiredAsterisk() {
  return <span className="text-primary ml-0.5" aria-hidden="true">*</span>;
}

function FieldLabel({ htmlFor, icon: Icon, children, required }: { htmlFor: string; icon: React.ElementType; children: React.ReactNode; required?: boolean }) {
  return (
    <Label htmlFor={htmlFor} className="text-zinc-300 text-sm font-medium flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-zinc-500" />
      {children}
      {required && <RequiredAsterisk />}
    </Label>
  );
}

export function ClientProfile() {
  const { user, status } = useClientAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bandName, setBandName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [clientType, setClientType] = useState<ClientType>("particulier");
  const [legalName, setLegalName] = useState("");
  const [siret, setSiret] = useState("");
  const [rna, setRna] = useState("");
  const [instagramAccounts, setInstagramAccounts] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const hasPrefilledRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      window.location.href = "/mon-compte/connexion";
      return;
    }
    if (hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setBandName(user.band_name || "");
    setAddressLine1(user.address_line1 || "");
    setAddressLine2(user.address_line2 || "");
    setPostalCode(user.postal_code || "");
    setCity(user.city || "");
    setClientType((user.client_type === "association" || user.client_type === "entreprise") ? user.client_type : "particulier");
    setLegalName(user.legal_name || "");
    setSiret(user.siret || "");
    setRna(user.rna || "");
    setInstagramAccounts(user.instagram_accounts || "");
    setLoading(false);
  }, [status, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const name = `${firstName} ${lastName}`.trim();
      const visibleFields = getVisibleBookingFields(clientType);
      const payload: Record<string, string | null | undefined> = {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        name,
        email: email || undefined,
        phone: phone || undefined,
        band_name: bandName || undefined,
        address_line1: addressLine1 || undefined,
        address_line2: addressLine2 || undefined,
        postal_code: postalCode || undefined,
        city: city || undefined,
        client_type: clientType,
        legal_name: visibleFields.includes("legalName") ? legalName || null : null,
        siret: visibleFields.includes("siret") ? siret || null : null,
        rna: visibleFields.includes("rna") ? rna || null : null,
        instagram_accounts: visibleFields.includes("instagramAccounts") ? instagramAccounts || null : null,
      };
      if (password.length > 0) {
        payload.password = password;
      }
      const res = await fetch("/api/client/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Erreur lors de la mise à jour");
        setSaving(false);
        return;
      }

      setSuccess("Profil mis à jour avec succès");
      await refresh({ force: true });
      setSaving(false);
    } catch {
      setError("Erreur de connexion au serveur");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] bg-black flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] bg-black flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-black px-2 lg:px-4 pt-32 pb-16">
      <div className="container max-w-3xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="font-blanka text-4xl lg:text-6xl">MON PROFIL</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-white">Mes informations</h2>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <FieldLabel htmlFor="profile-firstname" icon={User} required>Prénom</FieldLabel>
                  <Input
                    id="profile-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={saving}
                    className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="profile-lastname" icon={User} required>Nom</FieldLabel>
                  <Input
                    id="profile-lastname"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={saving}
                    className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="profile-client-type" icon={Building2} required>Type de client</FieldLabel>
                <select
                  id="profile-client-type"
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value as ClientType)}
                  disabled={saving}
                  className="w-full rounded-md bg-white/10 border border-white/15 text-white h-11 px-3 focus:border-primary focus:outline-none"
                >
                  <option value="particulier" className="bg-zinc-900">Particulier</option>
                  <option value="association" className="bg-zinc-900">Association</option>
                  <option value="entreprise" className="bg-zinc-900">Entreprise</option>
                </select>
              </div>

              {clientType !== "particulier" && (
                <div className="space-y-5 rounded-xl border border-white/10 p-4">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="profile-legal-name" icon={Building2} required>Raison sociale</FieldLabel>
                    <Input id="profile-legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={saving} placeholder={clientType === "association" ? "Nom de votre association" : "Nom de votre entreprise"} className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11" />
                  </div>
                  {(clientType === "entreprise" || clientType === "association") && (
                    <div className="space-y-2">
                      <FieldLabel htmlFor="profile-siret" icon={Hash} required={clientType === "entreprise"}>SIRET</FieldLabel>
                      <Input id="profile-siret" value={siret} onChange={(e) => setSiret(e.target.value)} disabled={saving} placeholder="732 829 320 00074" className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11" />
                      {siret && !isValidSiret(siret) && <p className="text-xs text-amber-400">Le SIRET doit comporter 14 chiffres valides.</p>}
                    </div>
                  )}
                  {clientType === "association" && (
                    <div className="space-y-2">
                      <FieldLabel htmlFor="profile-rna" icon={Hash}>Numéro RNA</FieldLabel>
                      <Input id="profile-rna" value={rna} onChange={(e) => setRna(e.target.value)} disabled={saving} placeholder="W123456789" className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11" />
                      {rna && !isValidRna(rna) && <p className="text-xs text-amber-400">Le numéro RNA doit être au format W123456789.</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <FieldLabel htmlFor="profile-instagram" icon={Music}>Compte(s) Instagram</FieldLabel>
                <Input id="profile-instagram" value={instagramAccounts} onChange={(e) => setInstagramAccounts(e.target.value)} disabled={saving} placeholder="@moncompte" className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11" />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="profile-email" icon={Mail} required>Email</FieldLabel>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  disabled={saving}
                  className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <FieldLabel htmlFor="profile-phone" icon={Phone}>Téléphone</FieldLabel>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    disabled={saving}
                    className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="profile-band" icon={Music}>Nom du groupe</FieldLabel>
                  <Input
                    id="profile-band"
                    type="text"
                    value={bandName}
                    onChange={(e) => setBandName(e.target.value)}
                    placeholder="Nom de votre groupe"
                    disabled={saving}
                    className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="profile-address1" icon={Home} required>Adresse</FieldLabel>
                <Input
                  id="profile-address1"
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Numéro et rue"
                  disabled={saving}
                  className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="profile-address2" icon={Building2}>Complément d'adresse</FieldLabel>
                <Input
                  id="profile-address2"
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Bâtiment, étage..."
                  disabled={saving}
                  className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <FieldLabel htmlFor="profile-postal" icon={Hash} required>Code postal</FieldLabel>
                  <Input
                    id="profile-postal"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="94370"
                    disabled={saving}
                    className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="profile-city" icon={MapPin} required>Ville</FieldLabel>
                  <Input
                    id="profile-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Sucy-en-Brie"
                    disabled={saving}
                    className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-white">Sécurité</h2>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="profile-password" icon={Lock}>Nouveau mot de passe</FieldLabel>
              <Input
                id="profile-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Laisser vide pour ne pas changer"
                disabled={saving}
                className="bg-white/10 border-white/15 text-white placeholder:text-zinc-600 focus-visible:border-primary focus-visible:ring-primary/30 h-11"
              />
              <p className="text-xs text-zinc-600 mt-1">Laissez ce champ vide si vous ne souhaitez pas modifier votre mot de passe.</p>
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-3 text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-5 py-4">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 text-sm text-green-400 bg-green-950/40 border border-green-900/40 rounded-xl px-5 py-4">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              {success}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1 h-11 text-sm font-semibold bg-primary text-black hover:bg-primary/90"
              disabled={saving}
            >
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 h-11 px-6"
              onClick={() => navigate("/mon-compte")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
