"use client";

import { useState } from "react";
import { Tag, Check, X, Loader2 } from "lucide-react";

import { type PromoCode } from "@/lib/booking";

interface PromoCodeInputProps {
  total: number;
  appliedPromo: PromoCode | null;
  onApply: (promo: PromoCode, discount: number) => void;
  onRemove: () => void;
}

export function PromoCodeInput({ total, appliedPromo, onApply, onRemove }: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), total }),
      });
      const json = await res.json() as { success: boolean; data?: { valid: boolean; promo?: PromoCode; discount?: number; error?: string } };
      const data = json.data;
      if (data?.valid && data.promo && data.discount !== undefined) {
        onApply(data.promo, data.discount);
        setCode("");
      } else {
        setError(data?.error || "Code invalide");
      }
    } catch {
      setError("Erreur de connexion, réessayez");
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  if (appliedPromo) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">
            {appliedPromo.code}
          </span>
          <span className="text-xs text-green-400/70">
            — {appliedPromo.description}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-1 transition-colors hover:bg-white/10"
          aria-label="Retirer le code promo"
        >
          <X className="h-3.5 w-3.5 text-white/50" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            id="promo-code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Code promo"
            aria-describedby={error ? "promo-code-error" : undefined}
            className="w-full rounded-lg border border-white/20 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={!code.trim() || isValidating}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:bg-transparent disabled:hover:text-white/70"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Appliquer"
          )}
        </button>
      </div>
      {error && (
        <p id="promo-code-error" role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
