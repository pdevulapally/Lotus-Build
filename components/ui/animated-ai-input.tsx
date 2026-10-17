"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Check, Loader2, Crown, Mic, Square, Leaf, X, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { currentBackend } from "@/lib/backend/browser";
import { createBuild, pendingBuild } from "@/lib/backend/create-build";
import { resolveModelSelection } from "@/lib/backend/model-selection";

import {
  COMPUTER_SESSION_MODES,
  getComputerSessionModeConfig,
  type ComputerSessionMode,
} from "@/lib/backend/session-modes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { draftKey, readSessionDraft, saveSessionDraft } from "@/lib/backend/draft";
/* ─── textarea auto-resize ─────────────────────────────────────────────────── */

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

/* ─── types ─────────────────────────────────────────────────────────────────── */

interface AnimatedAIInputProps {
  suggestedPrompt?: string;
  promptRequestId?: number;
  suggestedMode?: 'build' | 'plan';
  inputId?: string;
  portalClassName?: string;
  mode?: "create" | "chat";
  onSubmit?: (value: string, model: string) => void | Promise<void>;
  onStop?: () => void;
  placeholder?: string;
  isLoading?: boolean;
  compact?: boolean;
  compactSize?: "default" | "slim";
  visualEditToggle?: { active: boolean; onToggle: () => void };
  disabled?: boolean;
  initialModel?: string;
  contextBadge?: { label: string; value: string; onClear?: () => void } | null;
  submitLabel?: string;
  wrapperClassName?: string;
  footerHintsClassName?: string;
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/* ─── model metadata ─────────────────────────────────────────────────────────── */

// Model identity and availability come from the authenticated server catalog.
function getModelMeta(model: string) {
  return {
    label: model,
    description: "Model identifier from your current account.",
    badges: model.includes("/") ? ["Open Model"] : ["Model"],
  };
}

/* ─── badge component ─────────────────────────────────────────────────────── */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function ToolbarPill({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5",
        "text-xs font-medium text-muted-foreground transition-colors",
        "hover:bg-muted/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/35",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

function IconButton({ children, active, label, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground",
        "transition-colors duration-150",
        "hover:bg-muted/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/35",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
        active && "bg-muted/70 text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── main component ──────────────────────────────────────────────────────── */

export function AnimatedAIInput({
  suggestedPrompt,
  promptRequestId,
  suggestedMode,
  inputId,
  portalClassName,
  mode = "create",
  onSubmit,
  onStop,
  placeholder = "What can I help you build today?",
  isLoading = false,
  compact = false,
  compactSize = "default",
  visualEditToggle,
  disabled = false,
  initialModel,
  contextBadge,
  submitLabel,
  wrapperClassName,
  footerHintsClassName,
}: AnimatedAIInputProps) {
  const router = useRouter();
  const { user, account, accountError } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const [value, setValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [sessionMode, setSessionMode] = useState<ComputerSessionMode>("build");
  const [wasLoading, setWasLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const isSlimCompact = compact && compactSize === "slim";
  const minH = compact ? (isSlimCompact ? 60 : 76) : 96;
  const isSlimChat = mode === "chat" && isSlimCompact;

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: minH,
    maxHeight: compact ? (isSlimCompact ? 160 : 200) : 320,
  });

  const models = account?.models.map((model) => model.id) ?? [];
  const effectiveModel = mode === 'chat' && initialModel
    ? initialModel
    : resolveModelSelection(models, selectedModel);
  const displayModelLabel = account?.models.find((model) => model.id === effectiveModel)?.name || effectiveModel || 'Select model';
  const selectedSessionMode = getComputerSessionModeConfig(sessionMode);

  const draftRestoredRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseValueRef = useRef("");

  const syncTextareaHeight = useCallback(() => {
    requestAnimationFrame(() => adjustHeight());
  }, [adjustHeight]);

  /* effects ─── */

  useEffect(() => {
    if (suggestedPrompt === undefined) return;
    setValue(suggestedPrompt);
    requestAnimationFrame(() => { textareaRef.current?.focus(); adjustHeight(); });
  }, [suggestedPrompt, promptRequestId, textareaRef, adjustHeight]);
  useEffect(() => { if (suggestedMode) setSessionMode(suggestedMode); }, [suggestedMode, promptRequestId]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    setSpeechSupported(Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    ));
    return () => { recognitionRef.current?.abort(); recognitionRef.current = null; };
  }, []);



  useEffect(() => {
    if (!initialModel) return;
    setSelectedModel(initialModel);
  }, [initialModel]);

  useEffect(() => {
    if (mode !== 'create' || !user || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    try {
      const pending = pendingBuild(sessionStorage, user.uid);
      const draft = pending ?? readSessionDraft(sessionStorage);
      if (draft) { setValue(draft.prompt); setSessionMode(draft.mode); if (pending) setSelectedModel(pending.model); requestAnimationFrame(() => adjustHeight()); }
    } catch (reason) { setSubmitError(reason instanceof Error ? reason.message : 'Could not restore your draft.'); }
  }, [mode, user, adjustHeight]);

  /* handlers ─── */

  const handleSubmit = async () => {
    if (!value.trim() || isCreating || isLoading || disabled || submittingRef.current) return;
    setSubmitError(null);
    recognitionRef.current?.stop();
    setIsListening(false);

    if (mode === "chat" && onSubmit) {
      const v = value.trim();
      submittingRef.current = true;
      try { await onSubmit(v, effectiveModel); setValue(''); adjustHeight(true); }
      catch (error) { setSubmitError(error instanceof Error ? error.message : 'Could not send message.'); }
      finally { submittingRef.current = false; }
      return;
    }

    if (mode === "create" && !user) {
      saveSessionDraft(sessionStorage, { prompt: value.trim(), mode: sessionMode });
      router.push("/login?redirect=" + encodeURIComponent("/"));
      return;
    }
    setIsCreating(true);
    submittingRef.current = true;
    try {
      if (!user || !account) throw new Error(accountError || 'Account details are not available.');
      if (!effectiveModel) throw new Error(models.length ? 'The selected model is no longer available. Choose another model.' : 'No models are currently available for your account. Refresh your account details and try again.');
      if (sessionMode !== 'build' && sessionMode !== 'plan') throw new Error('Choose Build or Plan.');
      const data = await createBuild(currentBackend(), sessionStorage, { uid: user.uid, prompt: value.trim(), model: effectiveModel, mode: sessionMode });
      sessionStorage.removeItem(draftKey);
      router.push(`/computer/${data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create session.');
      setIsCreating(false);
    } finally { submittingRef.current = false; }
  };

  const handleToggleSpeech = () => {
    if (disabled || isCreating || isLoading || !speechSupported) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }

    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { setSpeechSupported(false); return; }

    const rec = new Ctor() as SpeechRecognitionLike;
    recognitionRef.current = rec;
    speechBaseValueRef.current = value.trimEnd();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i]?.[0]?.transcript ?? "";
      if (!t.trim()) return;
      const p = speechBaseValueRef.current;
      setValue(p ? `${p} ${t.trim()}` : t.trim());
      syncTextareaHeight();
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    try { rec.start(); setIsListening(true); } catch { setIsListening(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isSubmit = (e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter");
    if (isSubmit && value.trim() && !isCreating && !isLoading && !disabled) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = value.trim().length > 0 && !isCreating && !isLoading && !disabled;
  const canStop = mode === "chat" && isLoading && !disabled && typeof onStop === "function";
  const hasSubmitLabel = Boolean(submitLabel?.trim());

  /* ─── render ─────────────────────────────────────────────────────────────── */

  return (
    <div className={cn("w-full", mode === "create" ? "mx-auto max-w-2xl" : "max-w-none")}>
      <div
        className={cn(
          "composer-shell group/composer relative overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-200",
          "border-border bg-card",
          "hover:border-border-strong",
          "focus-within:border-border-strong",
          isSlimChat && "rounded-2xl border-border bg-card",
          disabled && "pointer-events-none opacity-55",
          wrapperClassName,
        )}
      >
        <AnimatePresence>
          {contextBadge && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden border-b border-border/50 bg-muted/30 px-3 py-2.5 sm:px-4"
            >
              <div className="flex w-fit max-w-full items-center gap-2 rounded-lg bg-background px-2.5 py-1.5 text-xs ring-1 ring-border/60">
                <span className="text-muted-foreground">{contextBadge.label}</span>
                <span className="truncate font-medium text-foreground">{contextBadge.value}</span>
                {contextBadge.onClear && (
                  <button
                    type="button"
                    onClick={contextBadge.onClear}
                    aria-label="Clear context"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn("px-3 pt-3 sm:px-4 sm:pt-4", compact && "pt-2.5 sm:pt-3", isSlimChat && "px-5 pt-4")}>
          <textarea
            id={inputId}
            ref={textareaRef}
            value={value}
            aria-label={mode === "chat" ? "Message the agent" : "Describe the software you want to build"}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
            className={cn(
              "w-full resize-none appearance-none border-0 bg-transparent p-0",
              "text-[15px] leading-[1.65] tracking-[-0.01em] text-foreground",
              "placeholder:text-muted-foreground/80",
              "outline-none focus:outline-none focus:ring-0",
              "[scrollbar-width:thin]",
              compact
                ? isSlimCompact ? "min-h-[60px]" : "min-h-[76px]"
                : "min-h-[96px]",
              isSlimChat && "min-h-[54px] text-[14px] leading-[1.55]",
            )}
          />
          {submitError && <div role="alert" className="mt-2 text-sm text-destructive">
            <p>{submitError}</p>
            {mode === 'create' && user && <button type="button" className="mt-1 underline" onClick={() => {
              sessionStorage.removeItem(`lotus-current-build:${user.uid}`); setSubmitError(null);
            }}>Discard pending request</button>}
          </div>}
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2 px-2.5 pb-2 pt-1 sm:px-3 sm:pb-2.5",
            isSlimCompact && "py-1.5",
            isSlimChat && "px-3.5 pb-3 pt-0",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mode === "create" && !compact && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarPill className="max-w-[9rem]" aria-label="Choose session mode">
                    <span className="truncate text-foreground">{selectedSessionMode.label}</span>
                    <ChevronUp className="h-3 w-3 shrink-0 opacity-45" />
                  </ToolbarPill>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  avoidCollisions={false}
                  className={cn("w-[18rem] rounded-lg border border-border bg-popover p-1.5 shadow-lg", portalClassName)}
                >
                  <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Mode
                  </DropdownMenuLabel>
                  {COMPUTER_SESSION_MODES.map((option) => {
                    const isSelected = sessionMode === option.id;
                    return (
                      <DropdownMenuItem
                        key={option.id}
                        onSelect={() => setSessionMode(option.id)}
                        className="rounded-md px-3 py-2.5 focus:bg-muted"
                      >
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{option.label}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                          {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {mode === "chat" && visualEditToggle && (
              <ToolbarPill
                onClick={visualEditToggle.onToggle}
                className={cn(
                  visualEditToggle.active && "bg-accent text-accent-foreground hover:bg-accent/85 hover:text-accent-foreground",
                )}
              >
                {visualEditToggle.active ? "Visual edit on" : "Visual edit"}
              </ToolbarPill>
            )}

            {user && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill className="max-w-[6.5rem] sm:max-w-[9rem]" aria-label={mode === 'chat' ? 'Session model' : 'Choose model'} disabled={mode === 'chat'}>
                  <span className="truncate text-foreground">{displayModelLabel}</span>
                  <ChevronUp className="h-3 w-3 shrink-0 opacity-45" />
                </ToolbarPill>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className={cn("max-h-[60vw] w-[calc(100vw-2rem)] max-w-[22rem] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1.5 shadow-lg sm:max-h-[26rem]", portalClassName)}
              >
                <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Model
                </DropdownMenuLabel>

                <DropdownMenuItem
                  disabled
                  className="rounded-md px-3 py-2.5 focus:bg-muted"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Leaf className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Available models</p>
                        <p className="text-xs text-muted-foreground">From your current plan</p>
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {models.map((model) => {
                  const meta = getModelMeta(model);
                  const isLocked = false;
                  const isSelected = effectiveModel === model;
                  return (
                    <DropdownMenuItem
                      key={model}
                      onSelect={() => {
                        if (isLocked) { router.push("/pricing"); return; }
                        setSelectedModel(model);
                      }}
                      className="rounded-md px-3 py-2.5 focus:bg-muted"
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn("text-sm font-medium", isLocked ? "text-foreground/70" : "text-foreground")}>
                              {account?.models.find((entry) => entry.id === model)?.name || model}
                            </span>
                            {meta.badges.map((b) => (
                              <Badge key={b}>{b}</Badge>
                            ))}
                            {isLocked && <Badge>Pro</Badge>}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {meta.description}
                          </p>
                        </div>
                        {isLocked ? (
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                            <Crown className="h-3 w-3 text-accent-soft-foreground" />
                          </span>
                        ) : isSelected ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                        ) : null}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {!canStop && (
              <IconButton
                label={isListening ? "Stop voice input" : "Start voice input"}
                onClick={handleToggleSpeech}
                disabled={disabled || isCreating || isLoading || !speechSupported}
                active={isListening}
              >
                {isListening
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Mic className="h-4 w-4" />
                }
              </IconButton>
            )}

            <motion.button
              type="button"
              aria-label={canStop ? "Stop generating" : (submitLabel?.trim() || "Start computer session")}
              disabled={!canSubmit && !canStop}
              onClick={canStop ? onStop : handleSubmit}
              whileTap={canSubmit || canStop ? { scale: 0.94 } : {}}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full font-semibold transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/35",
                hasSubmitLabel && (canSubmit || canStop)
                  ? "h-9 gap-1.5 px-3.5 text-xs"
                  : "h-9 w-9",
                canStop
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : canSubmit
                    ? isSlimChat
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {canStop ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" />
                  {hasSubmitLabel && <span>Stop</span>}
                </>
              ) : isCreating || isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasSubmitLabel ? (
                <>
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span>{submitLabel}</span>
                </>
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {!compact && mode === "create" && (
        <p className={cn("mt-2.5 text-center text-[11px] text-muted-foreground", footerHintsClassName)}>
          <kbd className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
          {" "}to send ·{" "}
          <kbd className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd>
          {" "}for new line
        </p>
      )}
    </div>
  );
}
