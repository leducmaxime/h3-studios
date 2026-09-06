import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

// En dessous de `lg`, la modale se comporte comme une feuille ancrée en bas
// d'écran (pleine largeur, coins arrondis seulement en haut, glissée depuis
// le bas) plutôt que la carte centrée du desktop : plus facile à atteindre
// à une main, et le clavier virtuel (formulaires) ne la fait pas sortir de
// l'écran puisqu'elle est déjà collée au bord bas. `bottom-0`/`inset-x-0`
// suffisent à la positionner, donc AUCUNE translation statique n'est posée
// en mobile — ce qui laisse `slide-in-from-bottom`/`slide-out-to-bottom`
// piloter seuls le `transform` pendant l'animation, sans entrer en conflit
// avec un `translate-x-[-50%]` de centrage (celui-ci n'existe qu'à `lg`).
// À partir de `lg`, tout est réécrit à l'identique du rendu desktop
// d'origine (carte centrée, `zoom-in-95`/`zoom-out-95`, glissement neutralisé
// via `slide-*-0`) : le rendu desktop ne change pas d'un pixel.
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom fixed inset-x-0 bottom-0 top-auto z-50 flex w-full max-w-full max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto scroll-touch rounded-t-2xl rounded-b-none border-t border-x-0 border-b-0 p-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))] shadow-lg duration-200 outline-none lg:inset-x-auto lg:top-[50%] lg:left-[50%] lg:bottom-auto lg:z-50 lg:max-w-lg lg:max-h-[calc(100dvh-2rem)] lg:translate-x-[-50%] lg:translate-y-[-50%] lg:rounded-lg lg:border lg:pb-6 lg:data-[state=closed]:slide-out-to-bottom-0 lg:data-[state=open]:slide-in-from-bottom-0 lg:data-[state=closed]:zoom-out-95 lg:data-[state=open]:zoom-in-95 [&_[data-slot=label]:not(:last-child)]:mb-2 [&_[data-slot=label]+*]:mt-0 [&_:has(>[data-slot=label]:not(:last-child))]:gap-y-0",
          className
        )}
        {...props}
      >
        {/* Poignée décorative : signale la feuille comme un panneau qu'on
            fait glisser (convention "bottom sheet" mobile), même si le
            glissement à la souris n'est pas implémenté ici — la fermeture
            reste au tap sur le fond, la croix, ou un bouton "Annuler" du
            formulaire. N'existe qu'en mobile/tablette. */}
        <div
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-zinc-700 lg:hidden"
        />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Fermer"
            className="ring-offset-background focus:ring-ring absolute top-3 right-3 z-20 rounded-md p-2.5 opacity-60 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 text-zinc-300 hover:text-white hover:bg-zinc-700/50 lg:p-1"
          >
            <XIcon />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky top-0 z-10 flex shrink-0 flex-col gap-2 bg-inherit text-center lg:text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 bg-inherit lg:flex-row lg:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
