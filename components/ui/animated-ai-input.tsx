"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowRight, ArrowUp, Check, Crown, ImagePlus, Mic, Plus, Square, Leaf, X, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { VoiceWaveform } from "@/components/ui/voice-waveform";
import { AttachmentStrip } from "@/components/ui/attachment-strip";
import { imageFilesFrom, useComposerAttachments } from "@/hooks/use-composer-attachments";
import type { AttachmentRef } from "@/lib/backend/attachments";
import { useVoiceDictation, VOICE_ERRORS } from "@/hooks/use-voice-dictation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { currentBackend } from "@/lib/backend/browser";
import { pendingCommandStorage } from "@/lib/backend/pending-storage";
import { createBuild, pendingBuild } from "@/lib/backend/create-build";
import { resolveModelSelection } from "@/lib/backend/model-selection";
import { RequestErrorNotice } from "@/components/ui/request-error";

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
  appearance?: "default" | "assistant";
  onSubmit?: (value: string, model: string, attachments: AttachmentRef[]) => void | Promise<void>;
  onStop?: () => void;
  /** Cancel has been requested; the stop control waits for the server to confirm. */
  isStopping?: boolean;
  onManageProjects?: () => void;
  placeholder?: string;
  isLoading?: boolean;
  compact?: boolean;
  compactSize?: "default" | "slim";
  visualEditToggle?: { active: boolean; onToggle: () => void };
  disabled?: boolean;
  initialModel?: string;
  contextBadge?: { label: string; value: string; onClear?: () => void } | null;
  submitLabel?: string;
  submitButtonClassName?: string;
  wrapperClassName?: string;
  footerHintsClassName?: string;
}

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
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2.5",
        "text-xs font-medium text-muted-foreground transition-colors",
        "hover:bg-muted/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
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
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground",
        "transition-colors duration-150",
        "hover:bg-muted/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
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
  appearance = "default",
  onSubmit,
  onStop,
  isStopping = false,
  onManageProjects,
  placeholder,
  isLoading = false,
  compact = false,
  compactSize = "default",
  visualEditToggle,
  disabled = false,
  initialModel,
  contextBadge,
  submitLabel,
  submitButtonClassName,
  wrapperClassName,
  footerHintsClassName,
}: AnimatedAIInputProps) {
  const router = useRouter();
  const { user, account, accountError } = useAuth();
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const submittingRef = useRef(false);

  const [value, setValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [sessionMode, setSessionMode] = useState<ComputerSessionMode>("build");
  const [wasLoading, setWasLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");

  const isAssistant = appearance === "assistant";
  const isStart = mode === "create" && isAssistant;
  const isSlimCompact = compact && compactSize === "slim";
  const minH = isAssistant ? 56 : compact ? (isSlimCompact ? 60 : 76) : 96;
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
  const attachments = useComposerAttachments((file) => currentBackend().uploadAttachment(file));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const voice = useVoiceDictation((text) => {
    setValue((current) => (current.trimEnd() ? `${current.trimEnd()} ${text}` : text));
    requestAnimationFrame(() => { textareaRef.current?.focus(); adjustHeight(); });
  });
  const isListening = voice.listening;

  const draftRestoredRef = useRef(false);

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
    if (!initialModel) return;
    setSelectedModel(initialModel);
  }, [initialModel]);

  useEffect(() => {
    if (mode !== 'create' || !user || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    try {
      const pending = pendingBuild(pendingCommandStorage(), user.uid);
      const draft = pending ?? readSessionDraft(sessionStorage);
      if (draft) { setValue(draft.prompt); setSessionMode(draft.mode); if (pending) setSelectedModel(pending.model); requestAnimationFrame(() => adjustHeight()); }
    } catch (reason) { setSubmitError(reason instanceof Error ? reason : new Error('Could not restore your draft.')); }
  }, [mode, user, adjustHeight]);

  /* handlers ─── */

  const handleSubmit = async () => {
    if (!value.trim() || isCreating || isLoading || disabled || submittingRef.current) return;
    setSubmitError(null);

    if (mode === "chat" && onSubmit) {
      const v = value.trim();
      submittingRef.current = true;
      try { await onSubmit(v, effectiveModel, attachments.refs); setValue(''); attachments.clear(); adjustHeight(true); }
      catch (error) { setSubmitError(error instanceof Error ? error : new Error('Could not send message.')); }
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
      const data = await createBuild(currentBackend(), pendingCommandStorage(), { uid: user.uid, prompt: value.trim(), model: effectiveModel, mode: sessionMode, attachments: attachments.refs });
      attachments.clear();
      sessionStorage.removeItem(draftKey);
      router.push(`/computer/${data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error('Could not create session.'));
      setIsCreating(false);
    } finally { submittingRef.current = false; }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isSubmit = (e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter");
    if (isSubmit && value.trim() && !isCreating && !isLoading && !disabled && !attachments.uploading && !attachments.failed) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const attachmentsSettled = !attachments.uploading && !attachments.failed;
  const canSubmit = value.trim().length > 0 && !isCreating && !isLoading && !disabled && attachmentsSettled;
  const canStop = mode === "chat" && isLoading && !disabled && !isStopping && typeof onStop === "function";
  const showStop = canStop || (mode === "chat" && isLoading && isStopping);
  const hasSubmitLabel = Boolean(submitLabel?.trim());

  /* ─── render ─────────────────────────────────────────────────────────────── */

  return (
    <div className={cn("w-full", mode === "create" ? "mx-auto max-w-2xl" : "max-w-none", isStart && "max-w-[760px]")}>
      <div
        data-slot={isStart ? "assistant-composer" : undefined}
        onDragOver={(e) => { if (!disabled && imageFilesFrom(e.dataTransfer).length === 0 && !Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) attachments.add(imageFilesFrom(e.dataTransfer)); }}
        className={cn(
          "group/composer relative overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
          "border-border bg-card",
          "hover:border-border-strong",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15",
          isSlimChat && "rounded-2xl border-border bg-card",
          isAssistant && "rounded-[28px] p-1 shadow-sm shadow-foreground/5",
          disabled && "pointer-events-none opacity-60",
          dragging && "border-ring ring-2 ring-ring/20",
          wrapperClassName,
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-card/90 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground"><ImagePlus className="h-4 w-4" />Drop images to attach</span>
          </div>
        )}
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

        <div className={cn("px-3 pt-3 sm:px-4 sm:pt-4", compact && "pt-2.5 sm:pt-3", isSlimChat && "px-5 pt-4", isAssistant && "px-3.5 pt-3 sm:px-4 sm:pt-4", isAssistant && isSlimChat && "sm:px-3.5 sm:pt-3")}>
          <AttachmentStrip items={attachments.items} onRemove={attachments.remove} className="mb-3" />
          {attachments.notice && (
            <p role="alert" className="mb-2 flex items-center gap-2 text-xs text-destructive">
              {attachments.notice}
              <button type="button" onClick={attachments.dismissNotice} aria-label="Dismiss" className="rounded-md p-0.5 hover:bg-accent"><X className="h-3 w-3" /></button>
            </p>
          )}
          {isListening ? (
            <VoiceWaveform levels={voice.levels} transcript={voice.transcript} onCancel={voice.cancel} onDone={voice.finish} />
          ) : (
          <textarea
            id={inputId}
            ref={textareaRef}
            value={value}
            aria-label={mode === "chat" ? "Message the agent" : "Describe the software you want to build"}
            placeholder={placeholder ?? (isStart ? "Ask LotusBuild to build anything…" : "What can I help you build today?")}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onPaste={(e) => { const files = imageFilesFrom(e.clipboardData); if (files.length) { e.preventDefault(); attachments.add(files); } }}
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
              isAssistant && "min-h-[56px] text-base placeholder:text-muted-foreground sm:text-[17px]",
              isAssistant && isSlimChat && "text-base leading-[1.6] sm:text-base",
            )}
          />
          )}
          {voice.error && !isListening && <p role="alert" className="mt-2 text-xs text-destructive">{voice.error}</p>}
        </div>

        <div
          data-slot="composer-toolbar"
          className={cn(
            "flex items-center justify-between gap-2 px-2.5 pb-2 pt-1 sm:px-3 sm:pb-2.5",
            isSlimCompact && "py-1.5",
            isSlimChat && "px-3.5 pb-3 pt-0",
            isAssistant && "px-2 pb-2 sm:px-2 sm:pb-2",
            isAssistant && isSlimChat && "pt-0.5",
          )}
        >
          <div data-slot="composer-tools" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mode === "create" && !compact && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarPill className={cn("max-w-[9rem]", isStart && "h-11 rounded-full")} aria-label="Choose session mode">
                    <span className="truncate text-foreground">{selectedSessionMode.label}</span>
                    <ChevronUp className="h-3 w-3 shrink-0 opacity-45" />
                  </ToolbarPill>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  avoidCollisions={false}
                  className={cn("w-[18rem] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-foreground/5", portalClassName)}
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  label="Add to message"
                  disabled={disabled || isCreating || isLoading || isListening}
                  active={attachments.items.length > 0}
                  className={cn("rounded-full", isAssistant && "h-11 w-11")}
                >
                  <Plus className="h-[18px] w-[18px]" />
                  {attachments.items.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {attachments.items.length}
                    </span>
                  )}
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-64 rounded-2xl p-1.5">
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()} className="cursor-pointer gap-3 rounded-xl px-2.5 py-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="text-[13px] font-medium">Upload image</span>
                    <span className="text-[11px] text-muted-foreground">PNG, JPEG, WebP or GIF, up to 5 MB</span>
                  </span>
                </DropdownMenuItem>
                <p className="px-2.5 pb-1 pt-2 text-[11px] text-muted-foreground">You can also paste or drop images here.</p>
              </DropdownMenuContent>
            </DropdownMenu>
            {user && (mode === "chat" ? (
              <span
                aria-label={`Session model: ${displayModelLabel}`}
                title={`Session model: ${displayModelLabel}`}
                className={cn("inline-flex h-8 max-w-[6.5rem] shrink-0 items-center rounded-xl px-2.5 text-xs text-muted-foreground sm:max-w-[9rem]", isAssistant && "h-11 rounded-full")}
              >
                <span className="truncate">{displayModelLabel}</span>
              </span>
            ) : <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill className={cn("max-w-[6.5rem] sm:max-w-[9rem]", isAssistant && "h-11 rounded-full")} aria-label="Choose model">
                  <span className="truncate text-foreground">{displayModelLabel}</span>
                  <ChevronUp className="h-3 w-3 shrink-0 opacity-45" />
                </ToolbarPill>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className={cn("max-h-[60vw] w-[calc(100vw-2rem)] max-w-[22rem] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-foreground/5 sm:max-h-[26rem]", portalClassName)}
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
            </DropdownMenu>)}
            {isStopping && <Shimmer className="ml-1 shrink-0 text-xs font-medium" role="status">Stopping…</Shimmer>}
          </div>

          <div data-slot="composer-actions" className="flex shrink-0 items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => { attachments.add(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />
            {!canStop && (
              <IconButton
                label={voice.supported ? "Start voice input" : VOICE_ERRORS.unsupported}
                onClick={voice.start}
                disabled={disabled || isCreating || isLoading || isListening || !voice.supported}
                title={voice.supported ? undefined : VOICE_ERRORS.unsupported}
                active={isListening}
                className={cn(isAssistant && "h-11 w-11 rounded-full")}
              >
                <Mic className="h-4 w-4" />
              </IconButton>
            )}

            <motion.button
              type="button"
              aria-label={isStopping ? "Stopping" : canStop ? "Stop generating" : (submitLabel?.trim() || (mode === "chat" ? "Send message" : "Start project"))}
              disabled={!canSubmit && !canStop}
              aria-busy={isStopping || undefined}
              onClick={canStop ? onStop : handleSubmit}
              whileTap={canSubmit || canStop ? { scale: 0.94 } : {}}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl border font-semibold transition-colors duration-150 disabled:cursor-not-allowed motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                hasSubmitLabel
                  ? "h-9 gap-1.5 px-3.5 text-xs"
                  : "h-9 w-9",
                canSubmit || canStop
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-muted text-muted-foreground",
                isAssistant && "h-11 rounded-full",
                isAssistant && !hasSubmitLabel && "w-11",
                submitButtonClassName,
              )}
            >
              {showStop ? (
                <>
                  <Square className={cn("h-3.5 w-3.5 fill-current", isStopping && "animate-pulse opacity-60")} />
                  {hasSubmitLabel && <span>Stop</span>}
                </>
              ) : isCreating || isLoading ? (
                <ArrowUp className="h-4 w-4 animate-pulse opacity-60" strokeWidth={2.5} />
              ) : hasSubmitLabel ? (
                <>
                  <span>{submitLabel}</span>
                  {mode === "create"
                    ? <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
                </>
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {!compact && !isStart && mode === "create" && (
        <p className={cn("mt-2.5 text-center text-[11px] text-muted-foreground", footerHintsClassName)}>
          <kbd className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
          {" "}to send ·{" "}
          <kbd className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd>
          {" "}for new line
        </p>
      )}
      <RequestErrorNotice error={submitError} planName={account?.plan.name} onClose={() => setSubmitError(null)} onManageProjects={onManageProjects} restoreFocus={() => textareaRef.current?.focus()}>
        {mode === 'create' && user && <button type="button" onClick={() => {
          pendingCommandStorage().removeItem(`lotus-current-build:${user.uid}`); setSubmitError(null);
        }}>Discard pending request</button>}
      </RequestErrorNotice>
    </div>
  );
}
