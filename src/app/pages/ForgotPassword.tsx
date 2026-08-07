"use client";

import { useState } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export function ForgotPassword() {
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
      const res = await fetch("/api/client/forgot-password", {
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
    <div className="min-h-[80vh] bg-black flex items-start justify-center px-2 lg:px-4 pt-32 pb-16">
      <div className="w-full max-w-md">
        <div className="mb-12 text-center">
          <h1 className="font-blanka text-4xl lg:text-5xl">MOT DE PASSE</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Email envoyé !</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Si un compte existe avec cet email, vous recevrez un lien pour réinitialiser votre mot de passe.
            </p>
            <Button
              onClick={() => navigate("/mon-compte/connexion")}
              className="w-full h-10 text-sm font-semibold"
            >
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-6">
              <p className="text-sm text-zinc-400">
                Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-zinc-300">
                Email <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  disabled={loading}
                  className="pl-10 bg-white/15 border-white/20 text-white placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-primary/30"
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
                onClick={() => navigate("/mon-compte/connexion")}
                className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
