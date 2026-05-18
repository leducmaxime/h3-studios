"use client";

import { useState } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez entrer un email valide");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
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

        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Email envoyé !</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Si un compte admin existe avec cet email, vous recevrez un lien pour réinitialiser votre mot de passe.
            </p>
            <Button
              onClick={() => navigate("/admin/login")}
              className="w-full h-10 text-sm font-semibold"
            >
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl shadow-black/50">
            <div className="text-center mb-2">
              <p className="text-sm text-zinc-400">
                Entrez votre email admin et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-forgot-email" className="text-zinc-300">
                Email <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="admin-forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@h3studios.fr"
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
              {loading ? "Envoi..." : "Envoyer le lien"}
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
