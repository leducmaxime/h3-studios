"use client";

import { Check, ChevronLeft, Pencil, UserCheck } from "lucide-react";
import { useState, useEffect, useRef, type FormEvent } from "react";
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
  clientLogout: () => Promise<{ ok: boolean; error?: string }>;
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
  clientLogout: () => Promise<{ ok: boolean; error?: string }>;
  initialEmail?: string;
}

function LoginCard({ clientUser, clientUserLoading, clientLogin, clientLogout, initialEmail }: LoginCardProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const prevInitialEmail = useRef<string | undefined>(undefined);

  // Sync initialEmail into loginEmail when it changes to a non-empty value
  useEffect(() => {
    if (initialEmail && initialEmail !== prevInitialEmail.current) {
      prevInitialEmail.current = initialEmail;
      setLoginEmail(initialEmail);
      // Focus the email input so the user can enter their password
      setTimeout(() => document.getElementById("loginEmail-bf")?.focus(), 100);
    }
  }, [initialEmail]);

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

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setLogoutError(null);
    try {
      const result = await clientLogout();
      if (!result.ok) {
        setLogoutError(result.error || "La déconnexion a échoué");
      }
    } catch {
      setLogoutError("Erreur réseau lors de la déconnexion");
    } finally {
      setLogoutLoading(false);
    }
  };

  if (clientUserLoading) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-5"
        aria-busy="true"
        aria-label="Vérification de votre compte"
      >
        <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <div className="h-[46px] flex-1 animate-pulse rounded-lg bg-white/10" />
          <div className="h-[46px] flex-1 animate-pulse rounded-lg bg-white/10" />
          <div className="h-[46px] animate-pulse rounded-lg bg-white/10 lg:w-36" />
        </div>
      </div>
    );
  }

  if (clientUser) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 lg:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              Connecté en tant que {clientUser.name.trim() || clientUser.email}
            </p>
            {clientUser.name.trim() && clientUser.email && (
              <p className="truncate text-xs text-white/50">{clientUser.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            aria-label="Se déconnecter"
            className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-red-400/50 hover:text-red-300 focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {logoutLoading ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>
        {logoutError && (
          <p role="status" aria-live="polite" className="mt-2.5 text-xs text-red-400">{logoutError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-5">
      <p className="mb-3 text-sm font-medium text-white/80">
        Déjà un compte ? Connectez-vous pour pré-remplir vos coordonnées.
      </p>
      <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-end">
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
          className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 lg:h-[46px]"
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-5">
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
        <div className="mt-4 flex flex-col gap-3 lg:gap-4">
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
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
                className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
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
                className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
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
  clientLogout,
  onUpdateField,
  onContinue,
  onBack,
  canContinue,
}: BookingFormProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [continueLoading, setContinueLoading] = useState(false);
  const [prefillLoginEmail, setPrefillLoginEmail] = useState("");

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

  const handleContinue = async () => {
    if (!canContinue || continueLoading) return;

    if (!validateForm()) return;

    // Guest email check: does this email belong to an existing account?
    if (!clientUser) {
      const emailToCheck = userEmail.trim();
      if (emailToCheck) {
        setContinueLoading(true);
        try {
          const res = await fetch("/api/client/check-email?email=" + encodeURIComponent(emailToCheck));
          const json = await res.json() as { success: boolean; data?: { hasAccount: boolean } };
          if (json.success && json.data?.hasAccount) {
            setValidationErrors((prev) => ({
              ...prev,
              userEmail: "Un compte existe avec cet email — connectez-vous ci-dessus pour continuer",
            }));
            setPrefillLoginEmail(emailToCheck);
            // Scroll LoginCard into view and focus the email input
            setTimeout(() => {
              document.getElementById("loginEmail-bf")?.focus();
              document.getElementById("loginEmail-bf")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
            setContinueLoading(false);
            return;
          }
        } catch (err) {
          // Fail open: network error → let the user through
          // (server-side enforcement in /api/bookings is the backstop)
          console.warn("[Booking] check-email fetch failed, proceeding:", err);
        } finally {
          setContinueLoading(false);
        }
      }
    }

    onContinue();
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

  // Logged-in: fields with a value on the account render as a read-only
  // summary. Fields missing on the account (old accounts may lack
  // phone/address) stay as normal inputs — otherwise the user dead-ends,
  // since the booking requires all 6 fields non-empty. State prefill from
  // the hook is untouched: validation always reads state, not the DOM.
  type AccountFieldKey =
    | "userName"
    | "userEmail"
    | "userPhone"
    | "bandName"
    | "billingAddress"
    | "billingPostalCode"
    | "billingCity";

  interface AccountField {
    key: AccountFieldKey;
    label: string;
    value: string;
    optional?: boolean;
    placeholder: string;
    type?: string;
    inputMode?: "numeric";
    maxLength?: number;
    digitsOnly?: boolean;
    autoComplete?: string;
  }

  const accountFields: AccountField[] = clientUser ? [
    { key: "userName", label: "Prénom et nom", value: userName, placeholder: "Jean Dupont", autoComplete: "name" },
    { key: "userEmail", label: "Email", value: clientUser.email || userEmail, placeholder: "jean@exemple.fr", type: "email", autoComplete: "email" },
    { key: "userPhone", label: "Téléphone", value: userPhone, placeholder: "0612345678", type: "tel", inputMode: "numeric", maxLength: 10, digitsOnly: true, autoComplete: "tel" },
    { key: "bandName", label: "Nom du groupe / Raison sociale", value: bandName, optional: true, placeholder: "Les Rockers", autoComplete: "organization" },
    { key: "billingAddress", label: "Adresse de facturation", value: billingAddress, placeholder: "12 Rue de la Musique", autoComplete: "street-address" },
    { key: "billingPostalCode", label: "Code postal", value: billingPostalCode, placeholder: "94370", inputMode: "numeric", maxLength: 5, digitsOnly: true, autoComplete: "postal-code" },
    { key: "billingCity", label: "Ville", value: billingCity, placeholder: "Sucy-en-Brie", autoComplete: "address-level2" },
  ] : [];
  const filledAccountFields = accountFields.filter((field) => field.value.trim().length > 0);
  const emptyAccountFields = accountFields.filter((field) => field.value.trim().length === 0);

  const renderAccountInput = (field: AccountField) => (
    <div key={field.key} className="flex flex-col gap-1.5">
      <label htmlFor={field.key} className="text-sm font-medium text-white/70">
        {field.label}{" "}
        {field.optional ? (
          <span className="text-white/40">(optionnel)</span>
        ) : (
          <span className="text-primary">*</span>
        )}
      </label>
      <input
        id={field.key}
        type={field.type ?? "text"}
        inputMode={field.inputMode}
        maxLength={field.maxLength}
        autoComplete={field.autoComplete}
        value={field.value}
        onChange={(e) =>
          updateFields({
            [field.key]: field.digitsOnly ? e.target.value.replace(/\D/g, "") : e.target.value,
          } as Partial<BookingFormFields>)
        }
        placeholder={field.placeholder}
        required={!field.optional}
        className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
          validationErrors[field.key] ? "border-red-500" : "border-white/20"
        }`}
      />
      {validationErrors[field.key] && (
        <span className="text-xs text-red-400">{validationErrors[field.key]}</span>
      )}
    </div>
  );

  const editAccountLink = (
    <a
      href="/mon-compte/profil"
      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary/80 transition-colors hover:text-primary lg:text-sm"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      Modifier mes coordonnées
    </a>
  );

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex items-center gap-3 lg:gap-4">
        <button
          onClick={onBack}
          className="rounded-full p-2 transition-colors hover:bg-white/15"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold lg:text-lg">Vos coordonnées</h3>
      </div>

      {/* Compte client : connexion inline */}
      <LoginCard
        clientUser={clientUser}
        clientUserLoading={clientUserLoading}
        clientLogin={clientLogin}
        clientLogout={clientLogout}
        initialEmail={prefillLoginEmail}
      />

      <div className="border-t border-white/10" aria-hidden="true" />

      {clientUser ? (
        <div className="flex flex-col gap-4 lg:gap-5">
          {filledAccountFields.length > 0 && (
            <section
              aria-label="Coordonnées de votre compte"
              className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 lg:mb-4">
                <h4 className="text-sm font-semibold text-white/80">Coordonnées de votre compte</h4>
                {editAccountLink}
              </div>
              <dl className="grid gap-x-6 gap-y-3 lg:grid-cols-2 lg:gap-y-4">
                {filledAccountFields.map((field) => (
                  <div key={field.key} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-white/40">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-white/90 lg:text-base">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {emptyAccountFields.length > 0 && (
            <div className="flex flex-col gap-3 lg:gap-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <p className="text-xs text-white/50 lg:text-sm">
                  {filledAccountFields.length > 0
                    ? "Ces informations sont absentes de votre compte — complétez-les pour cette réservation :"
                    : "Votre compte ne contient pas encore vos coordonnées — complétez-les pour cette réservation :"}
                </p>
                {filledAccountFields.length === 0 && editAccountLink}
              </div>
              <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
                {emptyAccountFields.map(renderAccountInput)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">
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
                className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="userEmail" className="text-sm font-medium text-white/70">
                Email <span className="text-primary">*</span>
              </label>
              <input
                id="userEmail"
                type="email"
                value={userEmail}
                onChange={(e) => updateFields({ userEmail: e.target.value })}
                placeholder="jean@exemple.fr"
                required
                className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
                  validationErrors.userEmail ? "border-red-500" : "border-white/20"
                }`}
              />
              {validationErrors.userEmail && (
                <span className="text-xs text-red-400">{validationErrors.userEmail}</span>
              )}
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
                className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
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
                className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:gap-4">
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
                className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3"
              />
            </div>
            <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">
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
                  className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
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
                  className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3"
                />
              </div>
            </div>
          </div>
        </>
      )}

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
          className="rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y lg:px-4 lg:py-3"
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
        disabled={!canContinue || continueLoading}
        className={`
          w-full rounded-lg py-3.5 text-base font-semibold transition-all lg:py-4 lg:text-lg
          ${canContinue && !continueLoading
            ? "bg-primary text-black hover:bg-primary/90"
            : "bg-white/15 text-white/50 cursor-not-allowed"
          }
        `}
      >
        {continueLoading ? "Vérification..." : canContinue ? "Continuer →" : "Remplissez tous les champs obligatoires"}
      </button>
    </div>
  );
}
