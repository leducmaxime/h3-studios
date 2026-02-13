"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Format d'email invalide");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
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

      window.location.href = "/admin";
    } catch {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-blanka text-4xl text-primary tracking-wider">H3 STUDIOS</h1>
          <p className="mt-2 text-zinc-400 text-sm">Administration</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl shadow-black/50"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@h3studios.fr"
              disabled={loading}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300">
              Mot de passe
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
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

        <p className="text-center text-xs text-zinc-600">
          H3 Studios &mdash; Sucy-en-Brie
        </p>
      </div>
    </div>
  );
}
