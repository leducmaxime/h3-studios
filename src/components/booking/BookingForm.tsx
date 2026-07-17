"use client";

import { Check, ChevronLeft, UserCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  type StudioId,
  type GroupType,
} from "@/lib/booking";

/**
 * Fields of the booking state this form reads/writes.
 * Subset of ExtendedBookingState (useBookingWithRouter) — the hook's
 * updateUserInfo accepts Partial<ExtendedBookingState>, so a
 * Partial<BookingFormFields> payload is always assignable.
 */
export interface BookingFormFields {
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  additionalInfo: string;
  createAccount: boolean;
  accountPassword: string;
  accountPasswordConfirm: string;
}

/** Client account shape returned by the hook (contract — see useBookingWithRouter). */
export interface BookingClientUser {
  id: string;
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
}

interface BookingFormProps {
  date: Date;
  startTime: string;
  endTime: string;
  studioId: StudioId;
  groupType: GroupType;
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  additionalInfo: string;
  createAccount: boolean;
  accountPassword: string;
  accountPasswordConfirm: string;
  clientUser: BookingClientUser | null;
  clientUserLoading: boolean;
  clientLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateField: (fields: Partial<BookingFormFields>) => void;
  onContinue: () => void;
  onBack: () => void;
  canContinue: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components: login card + account creation card
// ---------------------------------------------------------------------------

interface LoginCardProps {
  clientUser: BookingClientUser | null;
  clientUserLoading: boolean;
  clientLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
}

function LoginCard({ clientUser, clientUserLoading, clientLogin }: LoginCardProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;

    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Veuillez saisir votre email et votre mot de passe");
      return;
    }

    setLoginLoading(true);
    try {
      const result = await clientLogin(loginEmail.trim(), loginPassword);
      if (!result.ok) {
        setLoginError(result.error || "Email ou mot de passe incorrect");
        return;
      }
      setLoginPassword("");
    } catch {
      setLoginError("Erreur de connexion au serveur");
    } finally {
      setLoginLoading(false);
    }
  };

  if (clientUserLoading) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5"
        aria-busy="true"
        aria-label="Vérification de votre compte"
      >
        <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="h-[46px] flex-1 animate-pulse rounded-lg bg-white/10" />
          <div className="h-[46px] flex-1 animate-pulse rounded-lg bg-white/10" />
          <div className="h-[46px] animate-pulse rounded-lg bg-white/10 sm:w-36" />
        </div>
      </div>
    );
  }

  if (clientUser) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <UserCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Connecté en tant que {clientUser.name.trim() || clientUser.email}
          </p>
          {clientUser.name.trim() && clientUser.email && (
            <p className="truncate text-xs text-white/50">{clientUser.email}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <p className="mb-3 text-sm font-medium text-white/80">
        Déjà un compte ? Connectez-vous pour pré-remplir vos coordonnées.
      </p>
      <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="loginEmail-bf" className="text-xs font-medium text-white/60">Email</label>
          <input
            id="loginEmail-bf"
            type="email"
            autoComplete="email"
            value={loginEmail}
            onChange={(e) => { setLoginEmail(e.target.value); if (loginError) setLoginError(null); }}
            placeholder="jean@exemple.fr"
            className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="loginPassword-bf" className="text-xs font-medium text-white/60">Mot de passe</label>
          <input
            id="loginPassword-bf"
            type="password"
            autoComplete="current-password"
            value={loginPassword}
            onChange={(e) => { setLoginPassword(e.target.value); if (loginError) setLoginError(null); }}
            placeholder="••••••••"
            className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loginLoading}
          className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[46px]"
        >
          {loginLoading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      {loginError && (
        <p className="mt-2.5 text-xs text-red-400">{loginError}</p>
      )}
      <a
        href="/mon-compte/mot-de-passe-oublie"
        className="mt-2.5 inline-block text-xs text-white/40 transition-colors hover:text-primary"
      >
        Mot de passe oublié ?
      </a>
    </div>
  );
}

interface AccountCreationCardProps {
  createAccount: boolean;
  accountPassword: string;
  accountPasswordConfirm: string;
  validationErrors: Record<string, string>;
  onUpdateField: (fields: Partial<BookingFormFields>) => void;
}

function AccountCreationCard({ createAccount, accountPassword, accountPasswordConfirm, validationErrors, onUpdateField }: AccountCreationCardProps) {
  const passwordLongEnough = accountPassword.length >= 8;
  const passwordMixesLettersAndDigits = /[a-zA-ZÀ-ÿ]/.test(accountPassword) && /\d/.test(accountPassword);
  const passwordsMatch = accountPassword === accountPasswordConfirm;

  const handleCreateAccountToggle = (checked: boolean) => {
    onUpdateField(
      checked
        ? { createAccount: true }
        : { createAccount: false, accountPassword: "", accountPasswordConfirm: "" },
    );
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <label htmlFor="createAccount" className="flex cursor-pointer items-start gap-3">
        <input
          id="createAccount"
          type="checkbox"
          checked={createAccount}
          onChange={(e) => handleCreateAccountToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 accent-primary"
        />
        <span className="text-sm font-medium text-white/80">
          Créer mon compte pour gérer mes réservations{" "}
          <span className="font-normal text-white/40">(optionnel)</span>
        </span>
      </label>

      {createAccount && (
        <div className="mt-4 flex flex-col gap-3 sm:gap-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="accountPassword" className="text-sm font-medium text-white/70">
                Mot de passe <span className="text-primary">*</span>
              </label>
              <input
                id="accountPassword"
                type="password"
                autoComplete="new-password"
                value={accountPassword}
                onChange={(e) => onUpdateField({ accountPassword: e.target.value })}
                placeholder="8 caractères minimum"
                className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
                  validationErrors.accountPassword ? "border-red-500" : "border-white/20"
                }`}
              />
              {validationErrors.accountPassword && (
                <span className="text-xs text-red-400">{validationErrors.accountPassword}</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="accountPasswordConfirm" className="text-sm font-medium text-white/70">
                Confirmer le mot de passe <span className="text-primary">*</span>
              </label>
              <input
                id="accountPasswordConfirm"
                type="password"
                autoComplete="new-password"
                value={accountPasswordConfirm}
                onChange={(e) => onUpdateField({ accountPasswordConfirm: e.target.value })}
                placeholder="Retapez votre mot de passe"
                className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
                  validationErrors.accountPasswordConfirm ? "border-red-500" : "border-white/20"
                }`}
              />
              {validationErrors.accountPasswordConfirm ? (
                <span className="text-xs text-red-400">{validationErrors.accountPasswordConfirm}</span>
              ) : accountPasswordConfirm ? (
                <span className={`text-xs ${passwordsMatch ? "text-green-400" : "text-red-400"}`}>
                  {passwordsMatch ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                </span>
              ) : null}
            </div>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { ok: passwordLongEnough, label: "8 caractères minimum" },
              { ok: passwordMixesLettersAndDigits, label: "Lettres et chiffres" },
            ].map((criterion) => (
              <li
                key={criterion.label}
                className={`flex items-center gap-1.5 text-xs transition-colors ${criterion.ok ? "text-primary" : "text-white/40"}`}
              >
                <Check className="h-3.5 w-3.5" />
                {criterion.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BookingForm({
  userName,
  userEmail,
  userPhone,
  bandName,
  billingAddress,
  billingPostalCode,
  billingCity,
  additionalInfo,
  createAccount,
  accountPassword,
  accountPasswordConfirm,
  clientUser,
  clientUserLoading,
  clientLogin,
  onUpdateField,
  onContinue,
  onBack,
  canContinue,
}: BookingFormProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (userEmail && !emailRegex.test(userEmail)) {
      errors.userEmail = "L'email est invalide";
    }

    const phoneDigits = userPhone.replace(/\D/g, "");
    if (!userPhone.trim()) {
      errors.userPhone = "Le numéro de téléphone est obligatoire";
    } else if (phoneDigits.length !== 10) {
      errors.userPhone = "Le numéro de téléphone est invalide";
    }

    const postalCodeDigits = billingPostalCode.replace(/\D/g, "");
    if (billingPostalCode && postalCodeDigits.length !== 5) {
      errors.billingPostalCode = "Le code postal est invalide";
    }

    if (createAccount && !clientUser) {
      if (accountPassword.length < 8) {
        errors.accountPassword = "Le mot de passe doit contenir au moins 8 caractères";
      }
      if (accountPassword !== accountPasswordConfirm) {
        errors.accountPasswordConfirm = "Les mots de passe ne correspondent pas";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContinue = () => {
    if (!canContinue) return;

    if (validateForm()) {
      onContinue();
    }
  };

  const updateFields = (fields: Partial<BookingFormFields>) => {
    const touchedKeys = Object.keys(fields).filter((key) => validationErrors[key]);
    if (touchedKeys.length > 0) {
      setValidationErrors(prev => {
        const next = { ...prev };
        for (const key of touchedKeys) delete next[key];
        return next;
      });
    }
    onUpdateField(fields);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onBack}
          className="rounded-full p-2 transition-colors hover:bg-white/15"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold sm:text-lg">Vos coordonnées</h3>
      </div>

      {/* Compte client : connexion inline */}
      <LoginCard
        clientUser={clientUser}
        clientUserLoading={clientUserLoading}
        clientLogin={clientLogin}
      />

      <div className="border-t border-white/10" aria-hidden="true" />

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="userName" className="text-sm font-medium text-white/70">
            Prénom et Nom <span className="text-primary">*</span>
          </label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => updateFields({ userName: e.target.value })}
            placeholder="Jean Dupont"
            required
            className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="userEmail" className="text-sm font-medium text-white/70">
            Email <span className="text-primary">*</span>
          </label>
          <input
            id="userEmail"
            type="email"
            value={clientUser?.email || userEmail}
            onChange={(e) => updateFields({ userEmail: e.target.value })}
            placeholder="jean@exemple.fr"
            required
            disabled={!!clientUser}
            className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/60 sm:px-4 sm:py-3 ${
              validationErrors.userEmail ? "border-red-500" : "border-white/20"
            }`}
          />
          {clientUser ? (
            <span className="text-xs text-white/40">Email de votre compte</span>
          ) : validationErrors.userEmail ? (
            <span className="text-xs text-red-400">{validationErrors.userEmail}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="userPhone" className="text-sm font-medium text-white/70">
            Téléphone <span className="text-primary">*</span>
          </label>
          <input
            id="userPhone"
            type="tel"
            value={userPhone}
            onChange={(e) => updateFields({ userPhone: e.target.value.replace(/\D/g, "") })}
            placeholder="0612345678"
            maxLength={10}
            required
            className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
              validationErrors.userPhone ? "border-red-500" : "border-white/20"
            }`}
          />
          {validationErrors.userPhone && (
            <span className="text-xs text-red-400">{validationErrors.userPhone}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bandName" className="text-sm font-medium text-white/70">
            Nom du groupe / Raison Sociale <span className="text-white/40">(optionnel)</span>
          </label>
          <input
            id="bandName"
            type="text"
            value={bandName}
            onChange={(e) => updateFields({ bandName: e.target.value })}
            placeholder="Les Rockers"
            className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h4 className="text-sm font-semibold text-white/80">Adresse de facturation</h4>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="billingAddress" className="text-sm font-medium text-white/70">
            Nom et numéro de rue <span className="text-primary">*</span>
          </label>
          <input
            id="billingAddress"
            type="text"
            value={billingAddress}
            onChange={(e) => updateFields({ billingAddress: e.target.value })}
            placeholder="12 Rue de la Musique"
            required
            className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
          />
        </div>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="billingPostalCode" className="text-sm font-medium text-white/70">
              Code postal <span className="text-primary">*</span>
            </label>
            <input
              id="billingPostalCode"
              type="text"
              inputMode="numeric"
              value={billingPostalCode}
              onChange={(e) => updateFields({ billingPostalCode: e.target.value.replace(/\D/g, "") })}
              placeholder="94370"
              maxLength={5}
              required
              className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
                validationErrors.billingPostalCode ? "border-red-500" : "border-white/20"
              }`}
            />
            {validationErrors.billingPostalCode && (
              <span className="text-xs text-red-400">{validationErrors.billingPostalCode}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="billingCity" className="text-sm font-medium text-white/70">
              Ville <span className="text-primary">*</span>
            </label>
            <input
              id="billingCity"
              type="text"
              value={billingCity}
              onChange={(e) => updateFields({ billingCity: e.target.value })}
              placeholder="Sucy-en-Brie"
              required
              className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="additionalInfo" className="text-sm font-medium text-white/70">
          Informations supplémentaires
        </label>
        <textarea
          id="additionalInfo"
          value={additionalInfo}
          onChange={(e) => updateFields({ additionalInfo: e.target.value })}
          placeholder="Quels instruments ? Nombre de chanteurs ? besoin de matériel ? autres infos utiles..."
          rows={3}
          className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y sm:px-4 sm:py-3"
        />
      </div>

      {/* Création de compte optionnelle — invités seulement */}
      {!clientUserLoading && !clientUser && (
        <AccountCreationCard
          createAccount={createAccount}
          accountPassword={accountPassword}
          accountPasswordConfirm={accountPasswordConfirm}
          validationErrors={validationErrors}
          onUpdateField={updateFields}
        />
      )}

      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className={`
          w-full rounded-lg py-3.5 text-base font-semibold transition-all sm:py-4 sm:text-lg
          ${canContinue
            ? "bg-primary text-black hover:bg-primary/90"
            : "bg-white/15 text-white/50 cursor-not-allowed"
          }
        `}
      >
        {canContinue ? "Continuer →" : "Remplissez tous les champs obligatoires"}
      </button>
    </div>
  );
}
