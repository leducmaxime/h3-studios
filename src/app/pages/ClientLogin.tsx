"use client";

import { useState, useEffect } from "react";
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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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

    if (!name || !email || !password) {
      setError("Nom, email et mot de passe sont obligatoires");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
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
    <div className="min-h-[80vh] bg-black flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-blanka text-3xl md:text-4xl text-primary tracking-wider">MON COMPTE</h1>
          <p className="mt-2 text-zinc-400 text-sm">H3 Studios — Sucy-en-Brie</p>
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
              <Label htmlFor="login-email" className="text-zinc-300">Email</Label>
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
              <Label htmlFor="login-password" className="text-zinc-300">Mot de passe</Label>
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
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reg-name" className="text-zinc-300">Nom *</Label>
              <Input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                disabled={loading}
                className="bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-zinc-300">Email *</Label>
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
              <Label htmlFor="reg-phone" className="text-zinc-300">Téléphone</Label>
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
              <Label htmlFor="reg-password" className="text-zinc-300">Mot de passe *</Label>
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
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