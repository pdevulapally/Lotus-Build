"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Check, Loader2, Mic, Square, Leaf, X, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import {
  PLATFORM_OPTIONS,
  inferPlatformFromPrompt,
  type ProjectPlatform,
} from "@/lib/projects/platform";
import {
  COMPUTER_SESSION_MODES,
  getComputerSessionModeConfig,
  type ComputerSessionMode,
} from "@/lib/computer-agent/session-modes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const MODEL_META: Record<string, { label: string; description: string; badges: string[] }> = {
  "o3-mini": {
    label: "o3-mini",
    description: "Fast reasoning model for structured edits, debugging, and technical prompts.",
    badges: ["Reasoning", "Coding"],
  },
  "GPT-5.5": {
    label: "GPT-5.5",
    description: "Latest advanced model for high-quality site generation, complex refactors, and detailed builds.",
    badges: ["Latest", "Advanced"],
  },
  "GPT-4-1": {
    label: "GPT-4.1",
    description: "Strong general-purpose model for larger refactors and more detailed builds.",
    badges: ["Premium", "General"],
  },
  "Claude Sonnet 4.6": {
    label: "Claude Sonnet 4.6",
    description: "High-quality Claude model for robust coding, UI generation, and iterative product edits.",
    badges: ["Premium", "Claude"],
  },
  "Claude Sonnet 4": {
    label: "Claude Sonnet 4",
    description: "Balanced Claude model for reliable implementation and design-oriented updates.",
    badges: ["Premium", "Claude"],
  },
  "Claude Opus 4": {
    label: "Claude Opus 4",
    description: "Most capable Claude model for complex refactors and deeper reasoning workflows.",
    badges: ["Premium", "Claude"],
  },
  "minimaxai/minimax-m2.1": {
    label: "MiniMax M2.1",
    description: "Multi-language coding, app and web dev, office AI, and agent-style workflows.",
    badges: ["Open Source", "Agentic", "Multimodal"],
  },
  "meta/llama-3.3-70b-instruct": {
    label: "Llama 3.3 70B",
    description: "Strong open model for high-quality chat, coding, and instruction following.",
    badges: ["Open Source", "Coding"],
  },
  "meta/llama-3.1-405b-instruct": {
    label: "Llama 3.1 405B",
    description: "Large open-weight model suited for deeper reasoning and larger generation tasks.",
    badges: ["Open Source", "Reasoning"],
  },
  "deepseek-ai/deepseek-r1": {
    label: "DeepSeek R1",
    description: "Reasoning-heavy open model that performs well on planning and complex coding tasks.",
    badges: ["Open Source", "Reasoning", "Coding"],
  },
  "qwen/qwen2.5-coder-32b-instruct": {
    label: "Qwen 2.5 Coder 32B",
    description: "Code-focused open model for implementation, debugging, and developer workflows.",
    badges: ["Open Source", "Coding"],
  },
  "mistralai/mistral-small-3.1-24b-instruct": {
    label: "Mistral Small 3.1",
    description: "Compact open model for quick iteration, chat, and lightweight coding assistance.",
    badges: ["Open Source", "Fast"],
  },
  "google/gemma-3-27b-it": {
    label: "Gemma 3 27B",
    description: "Instruction-tuned open model for multimodal-style workflows and general tasks.",
    badges: ["Open Source", "Multimodal"],
  },
};

function getModelMeta(model: string) {
  if (MODEL_META[model]) return MODEL_META[model];
  const shortName = model.split("/").pop()?.replace(/-/g, " ") || model;
  return {
    label: shortName.replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "Provider model available for generation and iterative product building.",
    badges: model.includes("/") ? ["Open Model"] : ["Model"],
  };
}

/* ─── badge component ─────────────────────────────────────────────────────── */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </span>
  );
}

/* ─── icon button ─────────────────────────────────────────────────────────── */

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
        "relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
        "transition-all duration-150",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
        active && "bg-muted text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── main component ──────────────────────────────────────────────────────── */

export function AnimatedAIInput({
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
}: AnimatedAIInputProps) {
  const router = useRouter();
  const { user, userData } = useAuth();

  const [value, setValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [sessionMode, setSessionMode] = useState<ComputerSessionMode>("auto");
  const [autoMode, setAutoMode] = useState(true);
  const [wasLoading, setWasLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("GPT-5.5");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<ProjectPlatform>("web");
  const [platformTouched, setPlatformTouched] = useState(false);
  const [availableModels, setAvailableModels] = useState([
    "o3-mini", "GPT-5.5", "GPT-4-1",
    "Claude Sonnet 4.6",
    "minimaxai/minimax-m2.1",
    "meta/llama-3.3-70b-instruct",
    "deepseek-ai/deepseek-r1",
    "qwen/qwen2.5-coder-32b-instruct",
  ]);

  const isSlimCompact = compact && compactSize === "slim";
  const minH = compact ? (isSlimCompact ? 60 : 76) : 96;

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: minH,
    maxHeight: compact ? (isSlimCompact ? 160 : 200) : 320,
  });

  const isPaidUser = userData?.planId && userData.planId !== "free";
  const effectiveModel = autoMode ? "GPT-5.5" : selectedModel;
  const displayModelLabel = autoMode ? "Best model" : getModelMeta(selectedModel).label;
  const selectedSessionMode = getComputerSessionModeConfig(sessionMode);

  const PENDING_CREATE_KEY = "lotus-build_pending_create";
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseValueRef = useRef("");

  const syncTextareaHeight = useCallback(() => {
    requestAnimationFrame(() => adjustHeight());
  }, [adjustHeight]);

  /* effects ─── */

  useEffect(() => { if (!isPaidUser) setAutoMode(true); }, [isPaidUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSpeechSupported(Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    ));
    return () => { recognitionRef.current?.abort(); recognitionRef.current = null; };
  }, []);

  useEffect(() => {
    if (mode !== "create" || platformTouched || !value.trim()) return;
    const inferred = inferPlatformFromPrompt(value);
    setSelectedPlatform((current) => (current === inferred ? current : inferred));
  }, [mode, platformTouched, value]);

  useEffect(() => {
    if (wasLoading && !isLoading && mode === "chat") {
      setValue("");
      adjustHeight(true);
    }
    setWasLoading(isLoading || false);
  }, [isLoading, wasLoading, mode, adjustHeight]);

  useEffect(() => {
    if (!initialModel) return;
    if (initialModel === "GPT-5.5") { setAutoMode(true); setSelectedModel("GPT-5.5"); return; }
    setAutoMode(false);
    setSelectedModel(initialModel);
    setAvailableModels((cur) => cur.includes(initialModel) ? cur : [...cur, initialModel]);
  }, [initialModel]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/generate", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { models?: string[]; defaultModel?: string };
        if (!mounted || !Array.isArray(data.models) || data.models.length === 0) return;
        setAvailableModels(data.models);
        if (data.defaultModel && !autoMode) {
          setSelectedModel((cur) => data.models!.includes(cur) ? cur : data.defaultModel!);
        }
      } catch {}
    };
    load();
    return () => { mounted = false; };
  }, [autoMode]);

  /* handlers ─── */

  const handleSubmit = async () => {
    if (!value.trim() || isCreating || isLoading || disabled) return;
    recognitionRef.current?.stop();
    setIsListening(false);

    if (mode === "chat" && onSubmit) {
      const v = value.trim();
      setValue("");
      adjustHeight(true);
      await onSubmit(v, effectiveModel);
      return;
    }

    if (mode === "create" && !user) {
      sessionStorage.setItem(
        PENDING_CREATE_KEY,
        JSON.stringify({
          prompt: value.trim(),
          model: effectiveModel,
          platform: selectedPlatform,
          sessionMode,
        }),
      );
      router.push("/login?redirect=" + encodeURIComponent("/"));
      return;
    }

    setIsCreating(true);
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");
      const res = await fetch("/api/computer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          prompt: value.trim(),
          model: effectiveModel,
          platform: selectedPlatform,
          sessionMode,
        }),
      });
      const data = await res.json().catch(() => ({})) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Could not create session");
      router.push(`/computer/${data.id}`);
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
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
      {/* outer shell */}
      <div
        className={cn(
          "relative rounded-2xl border bg-card transition-all duration-200",
          "shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
          disabled && "opacity-55 pointer-events-none",
          isFocused
            ? "border-border shadow-[0_2px_20px_rgba(0,0,0,0.09)]"
            : "border-border/70 hover:border-border"
        )}
      >
        {/* context badge row */}
        <AnimatePresence>
          {contextBadge && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden px-4 pt-3"
            >
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/60 px-2.5 py-1.5 text-xs w-fit">
                <span className="text-muted-foreground">{contextBadge.label}</span>
                <span className="font-medium text-foreground">{contextBadge.value}</span>
                {contextBadge.onClear && (
                  <button
                    type="button"
                    onClick={contextBadge.onClear}
                    aria-label="Clear context"
                    className="ml-0.5 rounded p-px text-muted-foreground/60 transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* textarea */}
        <div className={cn("px-4 pt-3.5", contextBadge ? "pt-2.5" : "")}>
          <textarea
            ref={textareaRef}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
            className={cn(
              "w-full resize-none appearance-none border-0 bg-transparent p-0",
              "text-[15px] leading-relaxed text-foreground",
              "placeholder:text-muted-foreground/50",
              "outline-none focus:outline-none focus:ring-0",
              "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50",
              compact
                ? isSlimCompact ? "min-h-[60px]" : "min-h-[76px]"
                : "min-h-[96px]"
            )}
          />
        </div>

        {/* toolbar */}
        <div className={cn(
          "flex items-center justify-between gap-2 px-3 pb-3",
          isSlimCompact ? "pb-2.5" : ""
        )}>
          {/* left side */}
          <div className="flex items-center gap-1">
            {/* platform selector (create mode, non-compact only) */}
            {mode === "create" && !compact && (
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs font-medium">
                {PLATFORM_OPTIONS.map((option) => (
                  <motion.button
                    key={option.id}
                    type="button"
                    layout
                    onClick={() => {
                      setPlatformTouched(true);
                      setSelectedPlatform(option.id);
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-all duration-150",
                      selectedPlatform === option.id
                        ? "bg-amber-100 text-[#1c1c1c] shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </motion.button>
                ))}
              </div>
            )}

            {mode === "create" && !compact && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-7 items-center gap-1 rounded-lg border border-border/60 bg-muted/40",
                      "px-2.5 text-xs font-medium text-muted-foreground",
                      "transition-all duration-150 hover:bg-muted hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    )}
                    aria-label="Choose session mode"
                  >
                    <span className="text-foreground">{selectedSessionMode.label}</span>
                    <ChevronUp className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  avoidCollisions={false}
                  className={cn(
                    "w-[18rem] rounded-xl border border-border/70 bg-popover p-1.5 shadow-xl",
                    "backdrop-blur-sm"
                  )}
                >
                  <DropdownMenuLabel className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Mode
                  </DropdownMenuLabel>
                  {COMPUTER_SESSION_MODES.map((option) => {
                    const isSelected = sessionMode === option.id;
                    return (
                      <DropdownMenuItem
                        key={option.id}
                        onSelect={() => setSessionMode(option.id)}
                        className="rounded-lg px-3 py-2.5 focus:bg-muted"
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

            {/* visual edit toggle (chat mode) */}
            {mode === "chat" && visualEditToggle && (
              <button
                type="button"
                onClick={visualEditToggle.onToggle}
                className={cn(
                  "h-7 rounded-lg border px-2.5 text-xs font-medium transition-all duration-150",
                  visualEditToggle.active
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {visualEditToggle.active ? "Visual edit on" : "Visual edit"}
              </button>
            )}

            {/* model picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-lg border border-border/60 bg-muted/40",
                    "px-2.5 text-xs font-medium text-muted-foreground",
                    "transition-all duration-150 hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    "max-w-[140px] truncate"
                  )}
                >
                  <span className="truncate">{displayModelLabel}</span>
                  <ChevronUp className="h-3 w-3 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                avoidCollisions={false}
                className={cn(
                  "w-[22rem] max-h-[26rem] overflow-y-auto overscroll-contain",
                  "rounded-xl border border-border/70 bg-popover p-1.5 shadow-xl",
                  "backdrop-blur-sm"
                )}
              >
                <DropdownMenuLabel className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  Model
                </DropdownMenuLabel>

                {/* Best model option */}
                <DropdownMenuItem
                  onSelect={() => setAutoMode(true)}
                  className="rounded-lg px-3 py-2.5 focus:bg-muted"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Leaf className="h-3.5 w-3.5 text-foreground/60" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Best model</p>
                        <p className="text-xs text-muted-foreground">Automatically choose the best model for the task</p>
                      </div>
                    </div>
                    {autoMode && <Check className="h-3.5 w-3.5 text-foreground" />}
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {isPaidUser ? (
                  availableModels.map((model) => {
                    const meta = getModelMeta(model);
                    const isSelected = !autoMode && selectedModel === model;
                    return (
                      <DropdownMenuItem
                        key={model}
                        onSelect={() => { setAutoMode(false); setSelectedModel(model); }}
                        className="rounded-lg px-3 py-2.5 focus:bg-muted"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground">{meta.label}</span>
                              {meta.badges.slice(0, 2).map((b) => (
                                <Badge key={b}>{b}</Badge>
                              ))}
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {meta.description}
                            </p>
                          </div>
                          {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Custom models are available on paid plans.
                    </p>
                    <Link href="/pricing" className="mt-1.5 inline-flex text-xs font-medium text-foreground underline underline-offset-2">
                      Upgrade →
                    </Link>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* right side — mic + submit */}
          <div className="flex items-center gap-1">
            {/* mic button (hidden when stopping) */}
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

            {/* submit / stop button */}
            <motion.button
              type="button"
              aria-label={canStop ? "Stop generating" : (submitLabel?.trim() || "Start computer session")}
              disabled={!canSubmit && !canStop}
              onClick={canStop ? onStop : handleSubmit}
              whileTap={canSubmit || canStop ? { scale: 0.92 } : {}}
              className={cn(
                "flex items-center justify-center rounded-lg font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                // sizing
                hasSubmitLabel && (canSubmit || canStop)
                  ? "h-8 gap-1.5 px-3 text-xs"
                  : "h-8 w-8",
                // colour states
                canStop
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : canSubmit
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
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

      {/* hint text below the box */}
      {!compact && mode === "create" && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
          Press <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-px font-mono text-[10px]">Enter</kbd> to send,{" "}
          <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-px font-mono text-[10px]">Shift+Enter</kbd> for new line
        </p>
      )}
    </div>
  );
}