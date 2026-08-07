"use client";

import { useState } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tab = "login" | "register";

function getRedirectUrl(): string {
  if (typeof window === "undefined") return "/mon-compte";
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "/mon-compte";
}

export function ClientLogin() {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bandName, setBandName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Identifiants invalides");
        setLoading(false);
        return;
      }

      window.location.href = getRedirectUrl();
    } catch {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName || !lastName || !email || !password || !phone || !addressLine1 || !postalCode || !city) {
      setError("Prénom, nom, email, mot de passe, téléphone, adresse, code postal et ville sont obligatoires");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          bandName,
          addressLine1,
          postalCode,
          city,
          password,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Erreur lors de l'inscription");
        setLoading(false);
        return;
      }

      window.location.href = getRedirectUrl();
    } catch {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-black flex items-start justify-center px-2 lg:px-4 pt-32 pb-16">
      <div className="w-full max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="font-blanka text-4xl lg:text-6xl">MON COMPTE</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <div className="flex border-b border-zinc-800 mb-6">
          <button
            onClick={() => { setTab("login"); setError(""); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "login"
                ? "text-primary border-b-2 border-primary"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => { setTab("register"); setError(""); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "register"
                ? "text-primary border-b-2 border-primary"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Inscription
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-zinc-300">Email <span className="text-primary">*</span></Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-zinc-300">Mot de passe <span className="text-primary">*</span></Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-sm font-semibold"
              disabled={loading}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/mon-compte/mot-de-passe-oublie")}
                className="text-sm text-zinc-500 hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-firstname" className="text-zinc-300">Prénom <span className="text-primary">*</span></Label>
                <Input
                  id="reg-firstname"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  disabled={loading}
                  className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-lastname" className="text-zinc-300">Nom <span className="text-primary">*</span></Label>
                <Input
                  id="reg-lastname"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  disabled={loading}
                  className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-zinc-300">Email <span className="text-primary">*</span></Label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-phone" className="text-zinc-300">Téléphone <span className="text-primary">*</span></Label>
              <Input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-band" className="text-zinc-300">Nom du groupe</Label>
              <Input
                id="reg-band"
                type="text"
                value={bandName}
                onChange={(e) => setBandName(e.target.value)}
                placeholder="Les Rockers"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-address" className="text-zinc-300">Adresse <span className="text-primary">*</span></Label>
              <Input
                id="reg-address"
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="12 Rue de la Musique"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-postal" className="text-zinc-300">Code postal <span className="text-primary">*</span></Label>
                <Input
                  id="reg-postal"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="94370"
                  disabled={loading}
                  className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-city" className="text-zinc-300">Ville <span className="text-primary">*</span></Label>
                <Input
                  id="reg-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Sucy-en-Brie"
                  disabled={loading}
                  className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password" className="text-zinc-300">Mot de passe <span className="text-primary">*</span></Label>
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-sm font-semibold"
              disabled={loading}
            >
              {loading ? "Inscription..." : "Créer mon compte"}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-zinc-500 hover:text-primary transition-colors"
          >
            ← Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
}
