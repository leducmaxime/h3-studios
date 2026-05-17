"use client";

import { useState, useEffect } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientUser {
  id: string;
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
}

export function ClientProfile() {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bandName, setBandName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.data) {
          window.location.href = "/mon-compte/connexion";
          return;
        }
        const u = data.data as ClientUser;
        setUser(u);
        setFirstName(u.first_name || "");
        setLastName(u.last_name || "");
        setPhone(u.phone || "");
        setBandName(u.band_name || "");
        setAddressLine1(u.address_line1 || "");
        setAddressLine2(u.address_line2 || "");
        setPostalCode(u.postal_code || "");
        setCity(u.city || "");
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/mon-compte/connexion";
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const name = `${firstName} ${lastName}`.trim();
      const res = await fetch("/api/client/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          name,
          phone: phone || undefined,
          band_name: bandName || undefined,
          address_line1: addressLine1 || undefined,
          address_line2: addressLine2 || undefined,
          postal_code: postalCode || undefined,
          city: city || undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Erreur lors de la mise à jour");
        setSaving(false);
        return;
      }

      setSuccess("Profil mis à jour avec succès");
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
    <div className="min-h-[80vh] bg-black px-4 pt-32 pb-16">
      <div className="container max-w-2xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="font-blanka text-4xl md:text-5xl lg:text-6xl">MON PROFIL</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-6 text-lg text-white/60">{user.email}</p>
        </div>

        <p className="text-xs text-zinc-500 mb-3">Les champs marqués d'un <span className="text-red-400">*</span> sont obligatoires.</p>
        <form onSubmit={handleSubmit} className="space-y-5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-firstname" className="text-zinc-300">Prénom <span className="text-red-400">*</span></Label>
              <Input
                id="profile-firstname"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-lastname" className="text-zinc-300">Nom <span className="text-red-400">*</span></Label>
              <Input
                id="profile-lastname"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone" className="text-zinc-300">Téléphone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              disabled={saving}
              className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-band" className="text-zinc-300">Nom du groupe</Label>
            <Input
              id="profile-band"
              type="text"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              placeholder="Nom de votre groupe"
              disabled={saving}
              className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-address1" className="text-zinc-300">Adresse <span className="text-red-400">*</span></Label>
            <Input
              id="profile-address1"
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Numéro et rue"
              disabled={saving}
              className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-address2" className="text-zinc-300">Complément d'adresse</Label>
            <Input
              id="profile-address2"
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Bâtiment, étage..."
              disabled={saving}
              className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-postal" className="text-zinc-300">Code postal <span className="text-red-400">*</span></Label>
              <Input
                id="profile-postal"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="94370"
                disabled={saving}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-city" className="text-zinc-300">Ville <span className="text-red-400">*</span></Label>
              <Input
                id="profile-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Sucy-en-Brie"
                disabled={saving}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-400 bg-green-950/50 border border-green-900/50 rounded-lg px-4 py-3">
              {success}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1 h-10 text-sm font-semibold"
              disabled={saving}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 h-10"
              onClick={() => navigate("/mon-compte")}
            >
              Retour
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
