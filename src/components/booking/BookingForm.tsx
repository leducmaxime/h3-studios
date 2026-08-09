"use client";

import { AlertTriangle, Check, ChevronLeft, Pencil, UserCheck, X } from "lucide-react";
import { useState, useEffect, useRef, useMemo, type FormEvent } from "react";
import { accountFieldValues, BOOKING_FIELD_FORMAT_HINTS, BOOKING_FIELD_LABELS, computeAccountFieldStatus, isValidBookingFieldValue, REQUIRED_BOOKING_FIELDS, type BookingFieldIssue, type BookingFieldKey } from "@/lib/booking-fields";

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
  bookingFieldIssues?: BookingFieldIssue[];
  /** Failed POST /api/bookings — already French, ready to display. */
  submitError?: string | null;
  onClearSubmitError?: () => void;
}

// ---------------------------------------------------------------------------
// Field definitions — shared by the guest form and the logged-in editable
// block, so every required field is guaranteed an input AND an error site.
// Labels come from BOOKING_FIELD_LABELS (single source with the gate).
// ---------------------------------------------------------------------------

interface BookingFieldDef {
  key: BookingFieldKey;
  optional?: boolean;
  placeholder: string;
  type?: string;
  inputMode?: "numeric";
  maxLength?: number;
  digitsOnly?: boolean;
  autoComplete?: string;
}

const BOOKING_FIELD_DEFS: Record<BookingFieldKey, BookingFieldDef> = {
  userName: { key: "userName", placeholder: "Jean Dupont", autoComplete: "name" },
  userEmail: { key: "userEmail", placeholder: "jean@exemple.fr", type: "email", autoComplete: "email" },
  userPhone: { key: "userPhone", placeholder: "0612345678", type: "tel", inputMode: "numeric", maxLength: 10, digitsOnly: true, autoComplete: "tel" },
  bandName: { key: "bandName", optional: true, placeholder: "Les Rockers", autoComplete: "organization" },
  billingAddress: { key: "billingAddress", placeholder: "12 Rue de la Musique", autoComplete: "street-address" },
  billingPostalCode: { key: "billingPostalCode", placeholder: "94370", inputMode: "numeric", maxLength: 5, digitsOnly: true, autoComplete: "postal-code" },
  billingCity: { key: "billingCity", placeholder: "Sucy-en-Brie", autoComplete: "address-level2" },
};

function fieldDef(key: BookingFieldKey): BookingFieldDef {
  return BOOKING_FIELD_DEFS[key];
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
  bookingFieldIssues = [],
  submitError = null,
  onClearSubmitError,
}: BookingFormProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [continueLoading, setContinueLoading] = useState(false);
  const [prefillLoginEmail, setPrefillLoginEmail] = useState("");

  const validateAccountCreation = (): boolean => {
    const errors: Record<string, string> = {};

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
    if (continueLoading) return;
    // Retrying dismisses the previous submission failure.
    onClearSubmitError?.();
    if (!canContinue) {
      setValidationErrors((prev) => ({ ...prev, ...Object.fromEntries(bookingFieldIssues.map((issue) => [issue.key, issue.reason])) }));
      // Bring the first blocking field into view so the click self-explains.
      const firstIssue = bookingFieldIssues[0];
      if (firstIssue) {
        setTimeout(() => {
          document.getElementById(firstIssue.key)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
      return;
    }

    if (!validateAccountCreation()) return;

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

  // Logged-in: fields with a usable value on the account render as a
  // read-only summary. Fields missing or malformed on the account (old
  // accounts may lack phone/address, or store an outdated format) stay as
  // normal inputs — otherwise the user dead-ends, since the booking requires
  // all 6 fields non-empty. State prefill from the hook is untouched:
  // validation always reads state, not the DOM.
  const accountValues = useMemo(() => accountFieldValues(clientUser), [clientUser]);
  const accountFieldStatus = useMemo(() => computeAccountFieldStatus(clientUser), [clientUser]);
  const bookingValues: Record<BookingFieldKey, string> = { userName, userEmail, userPhone, bandName, billingAddress, billingPostalCode, billingCity };
  const filledAccountFieldDefinitions: BookingFieldDef[] = clientUser
    ? Object.values(BOOKING_FIELD_DEFS).filter((field) => accountFieldStatus[field.key] === "filled")
    : [];
  const editableAccountFieldDefinitions: BookingFieldDef[] = clientUser
    ? Object.values(BOOKING_FIELD_DEFS).filter((field) => accountFieldStatus[field.key] !== "filled")
    : [];

  /**
   * Single renderer for every coordonnées input — guest and logged-in.
   * `invalidAccountValue` marks a field whose saved account value failed the
   * booking's format rules: the input is pre-cleared, and an amber hint
   * explains why until the user types a usable value (or a red validation
   * error takes over). Red is reserved for actual errors, amber for
   * "the saved value could not be used", neutral for everything else.
   */
  const renderFieldInput = (
    field: BookingFieldDef,
    options?: { label?: string; invalidAccountValue?: boolean },
  ) => {
    const error = validationErrors[field.key];
    const currentValue = bookingValues[field.key];
    const currentValueUsable = currentValue.trim().length > 0 && isValidBookingFieldValue(field.key, currentValue);
    const showInvalidAccountHint = options?.invalidAccountValue === true && !error && !currentValueUsable;
    return (
      <div key={field.key} className="flex flex-col gap-1.5">
        <label htmlFor={field.key} className="text-sm font-medium text-white/70">
          {options?.label ?? BOOKING_FIELD_LABELS[field.key]}{" "}
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
          value={currentValue}
          onChange={(e) =>
            updateFields({
              [field.key]: field.digitsOnly ? e.target.value.replace(/\D/g, "") : e.target.value,
            } as Partial<BookingFormFields>)
          }
          placeholder={field.placeholder}
          required={!field.optional}
          aria-invalid={error ? true : undefined}
          className={`rounded-lg border bg-white/15 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary lg:px-4 lg:py-3 ${
            error ? "border-red-500" : showInvalidAccountHint ? "border-amber-400/50" : "border-white/20"
          }`}
        />
        {showInvalidAccountHint && (
          <span className="text-xs text-amber-300/80">
            La valeur enregistrée sur votre compte n'a pas pu être reprise — saisissez-la à nouveau.
            {BOOKING_FIELD_FORMAT_HINTS[field.key] ? ` ${BOOKING_FIELD_FORMAT_HINTS[field.key]}.` : ""}
          </span>
        )}
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    );
  };

  const editAccountLink = (
    <a
      href="/mon-compte/profil"
      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary/80 transition-colors hover:text-primary lg:text-sm"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      Modifier mes coordonnées
    </a>
  );

  const hasInvalidAccountFields = editableAccountFieldDefinitions.some((field) => accountFieldStatus[field.key] === "invalid");
  const hasRequiredEditableFields = editableAccountFieldDefinitions.some((field) => REQUIRED_BOOKING_FIELDS.includes(field.key));
  const headerCopy = hasInvalidAccountFields
    ? "Complétez ou corrigez ces informations pour cette réservation :"
    : hasRequiredEditableFields
      ? "Ces informations ne sont pas disponibles sur votre compte — complétez-les pour cette réservation :"
      : "Vous pouvez ajouter ces informations facultatives :";

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

      {/* Échec de l'envoi de la réservation — action réelle, affiché en évidence */}
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
          <p className="flex-1 text-sm font-medium text-red-200">{submitError}</p>
          <button
            type="button"
            onClick={onClearSubmitError}
            aria-label="Fermer le message"
            className="shrink-0 rounded-full p-1 text-red-300 transition-colors hover:bg-red-500/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
          {filledAccountFieldDefinitions.length > 0 && (
            <section
              aria-label="Coordonnées de votre compte"
              className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 lg:mb-4">
                <h4 className="text-sm font-semibold text-white/80">Coordonnées de votre compte</h4>
                {editAccountLink}
              </div>
              <dl className="grid gap-x-6 gap-y-3 lg:grid-cols-2 lg:gap-y-4">
                {filledAccountFieldDefinitions.map((field) => (
                  <div key={field.key} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-white/40">
                      {BOOKING_FIELD_LABELS[field.key]}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-white/90 lg:text-base">
                      {accountValues[field.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {editableAccountFieldDefinitions.length > 0 && (
            <div className="flex flex-col gap-3 lg:gap-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <p className="text-xs text-white/50 lg:text-sm">
                  {headerCopy}
                </p>
                {filledAccountFieldDefinitions.length === 0 && editAccountLink}
              </div>
              <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
                {editableAccountFieldDefinitions.map((field) =>
                  renderFieldInput(field, { invalidAccountValue: accountFieldStatus[field.key] === "invalid" }),
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">
            {(["userName", "userEmail", "userPhone", "bandName"] as BookingFieldKey[]).map((key) =>
              renderFieldInput(fieldDef(key)),
            )}
          </div>

          <div className="flex flex-col gap-3 lg:gap-4">
            <h4 className="text-sm font-semibold text-white/80">Adresse de facturation</h4>
            {renderFieldInput(fieldDef("billingAddress"), { label: "Nom et numéro de rue" })}
            <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">
              {renderFieldInput(fieldDef("billingPostalCode"))}
              {renderFieldInput(fieldDef("billingCity"))}
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
        type="button"
        onClick={handleContinue}
        disabled={continueLoading}
        aria-disabled={!canContinue}
        className={`
          w-full rounded-lg py-3.5 text-base font-semibold transition-all lg:py-4 lg:text-lg
          ${canContinue && !continueLoading
            ? "bg-primary text-black hover:bg-primary/90"
            : "bg-white/15 text-white/50 cursor-not-allowed"
          }
        `}
      >
        {continueLoading ? "Vérification..." : "Continuer →"}
      </button>
    </div>
  );
}
