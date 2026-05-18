"use client";

import { useState, useEffect } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

export function AdminResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reset, setReset] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setToken(params.get("token") || "");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Token manquant");
      return;
    }
    if (!password) {
      setError("Veuillez entrer un mot de passe");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      setReset(true);
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="font-blanka text-4xl text-primary tracking-wider">H3 STUDIOS</h1>
            <p className="mt-2 text-zinc-400 text-sm">Administration</p>
          </div>
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Lien invalide</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Ce lien de réinitialisation est invalide ou a expiré.
            </p>
            <Button
              onClick={() => navigate("/admin/login")}
              className="w-full h-10 text-sm font-semibold"
            >
              Retour à la connexion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-blanka text-4xl text-primary tracking-wider">H3 STUDIOS</h1>
          <p className="mt-2 text-zinc-400 text-sm">Administration</p>
        </div>

        {reset ? (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Mot de passe mis à jour !</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Votre mot de passe a été réinitialisé avec succès.
            </p>
            <Button
              onClick={() => navigate("/admin/login")}
              className="w-full h-10 text-sm font-semibold"
            >
              Se connecter
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl shadow-black/50">
            <div className="text-center mb-2">
              <p className="text-sm text-zinc-400">
                Choisissez un nouveau mot de passe pour votre compte admin.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-reset-password" className="text-zinc-300">
                Nouveau mot de passe <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="admin-reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  disabled={loading}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-reset-confirm" className="text-zinc-300">
                Confirmer le mot de passe <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="admin-reset-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez votre mot de passe"
                  disabled={loading}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
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
              {loading ? "Mise à jour..." : "Réinitialiser le mot de passe"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/admin/login")}
                className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-zinc-600">
          H3 Studios &mdash; Sucy-en-Brie
        </p>
      </div>
    </div>
  );
}
