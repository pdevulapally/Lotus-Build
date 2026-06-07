"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Check, Loader2, Square, Leaf, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { promptSuggestsSupabaseBackend } from "@/lib/project-blueprint";

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

interface AnimatedAIInputProps {
  mode?: "create" | "chat";
  onSubmit?: (value: string, model: string) => void | Promise<void>;
  onStop?: () => void;
  placeholder?: string;
  isLoading?: boolean;
  compact?: boolean;
  visualEditToggle?: { active: boolean; onToggle: () => void };
  disabled?: boolean;
  initialModel?: string;
  contextBadge?: { label: string; value: string; onClear?: () => void } | null;
  submitLabel?: string;
}

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
    label: shortName.replace(/\b\w/g, (char) => char.toUpperCase()),
    description: "Provider model available for generation and iterative product building.",
    badges: model.includes("/") ? ["Open Model"] : ["Model"],
  };
}

export function AnimatedAIInput({
  mode = "create",
  onSubmit,
  onStop,
  placeholder = "What can I help you build today?",
  isLoading = false,
  compact = false,
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
  const [creationMode, setCreationMode] = useState<"build" | "agent">("agent");
  const [autoMode, setAutoMode] = useState(true);
  const [wasLoading, setWasLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("GPT-5.5");
  const [availableModels, setAvailableModels] = useState([
    "o3-mini",
    "GPT-5.5",
    "GPT-4-1",
    "Claude Sonnet 4.6",
    "minimaxai/minimax-m2.1",
    "meta/llama-3.3-70b-instruct",
    "deepseek-ai/deepseek-r1",
    "qwen/qwen2.5-coder-32b-instruct",
  ]);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: compact ? 88 : 132,
    maxHeight: compact ? 220 : 360,
  });

  const isPaidUser = userData?.planId && userData.planId !== "free";
  const buildUsed = Math.max(0, Number(userData?.tokenUsage?.used ?? 0));
  const buildRemaining = Math.max(0, Number(userData?.tokenUsage?.remaining ?? 0));
  const buildTokenLimit = Math.max(0, Number(userData?.tokensLimit ?? 0), buildUsed + buildRemaining);
  const effectiveModel = autoMode ? "GPT-5.5" : selectedModel;

  const PENDING_CREATE_KEY = "lotus-build_pending_create";

  useEffect(() => {
    if (!isPaidUser) setAutoMode(true);
  }, [isPaidUser]);

  useEffect(() => {
    if (mode !== "create") setCreationMode("build");
  }, [mode]);

  useEffect(() => {
    if (wasLoading && !isLoading) {
      if (mode === "chat") {
        setValue("");
        adjustHeight(true);
      }
    }
    setWasLoading(isLoading || false);
  }, [isLoading, wasLoading, mode, adjustHeight]);

  useEffect(() => {
    if (!initialModel) return;

    if (initialModel === "GPT-5.5") {
      setAutoMode(true);
      setSelectedModel("GPT-5.5");
      return;
    }

    setAutoMode(false);
    setSelectedModel(initialModel);
    setAvailableModels((current) => (current.includes(initialModel) ? current : [...current, initialModel]));
  }, [initialModel]);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      try {
        const response = await fetch("/api/generate", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { models?: string[]; defaultModel?: string };
        if (!isMounted || !Array.isArray(data.models) || data.models.length === 0) return;
        const models = data.models;

        setAvailableModels(models);
        if (data.defaultModel && !autoMode) {
          setSelectedModel((current) => (models.includes(current) ? current : data.defaultModel!));
        }
      } catch (error) {
        console.error("Failed to load model list:", error);
      }
    };

    loadModels();

    return () => {
      isMounted = false;
    };
  }, [autoMode]);

  const handleSubmit = async () => {
    if (!value.trim() || isCreating || isLoading || disabled) return;

    if (mode === "chat" && onSubmit) {
      const submittedValue = value.trim();
      setValue("");
      adjustHeight(true);
      await onSubmit(submittedValue, effectiveModel);
      return;
    }

    if (mode === "create" && !user) {
      sessionStorage.setItem(
        PENDING_CREATE_KEY,
        JSON.stringify({
          prompt: value.trim(),
          model: effectiveModel,
          creationMode,
        })
      );
      router.push("/login?redirect=" + encodeURIComponent("/"));
      return;
    }

    setIsCreating(true);
    try {
      if (creationMode === "agent") {
        const idToken = await user?.getIdToken();
        if (!idToken) {
          throw new Error("Not authenticated - please sign in");
        }

        const response = await fetch("/api/computer/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            prompt: value.trim(),
            model: effectiveModel,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!response.ok || !data.id) {
          throw new Error(data.error || "Could not create computer session");
        }
        router.push(`/computer/${data.id}`);
        return;
      }

      const projectData: Record<string, unknown> = {
        prompt: value.trim(),
        model: effectiveModel,
        status: "pending",
        creationMode: "build",
        suggestsBackend: promptSuggestsSupabaseBackend(value.trim()),
        createdAt: serverTimestamp(),
        messages: [],
        ownerId: user!.uid,
        visibility: "private",
      };

      const docRef = await addDoc(collection(db, "projects"), projectData);
      router.push(`/project/${docRef.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isSubmitKey = (e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter");
    if (isSubmitKey && value.trim() && !isCreating && !isLoading) {
      if (disabled) return;
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = value.trim().length > 0 && !isCreating && !isLoading && !disabled;
  const canStop = mode === "chat" && isLoading && !disabled && typeof onStop === "function";
  const resolvedPlaceholder = placeholder;
  const submitAriaLabel = creationMode === "agent" ? "Start agent session" : "Start build";

  return (
    <div className="group w-full max-w-2xl">
      <div
        className={cn(
          "relative rounded-2xl border transition-all duration-300",
          "bg-white/80 backdrop-blur-2xl",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.6)_inset]",
          disabled
            ? "border-white/20 opacity-60"
            : isFocused
              ? "border-white/50 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.22),0_0_0_1px_rgba(255,255,255,0.7)_inset]"
              : "border-white/30 hover:border-white/45 hover:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.20),0_0_0_1px_rgba(255,255,255,0.65)_inset]"
        )}
      >
        <div className="relative px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
          {contextBadge ? (
            <div className="mb-3 flex max-w-[calc(100%-4rem)] items-center">
              <div className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs text-zinc-700">
                <span className="font-medium text-zinc-500">{contextBadge.label}</span>
                <span className="rounded-full bg-black/8 px-2 py-0.5 font-medium text-zinc-800">
                  {contextBadge.value}
                </span>
                {contextBadge.onClear ? (
                  <button
                    type="button"
                    onClick={contextBadge.onClear}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-black/8 hover:text-zinc-700"
                    aria-label="Clear selected context"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <Textarea
            id="ai-input-hero"
            value={value}
            placeholder={resolvedPlaceholder}
            className={cn(
              "w-full resize-none border-none bg-transparent px-0 pb-16 pt-0 text-[15px] text-zinc-900 sm:text-base",
              "placeholder:text-zinc-400",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-200",
              compact ? "min-h-[88px]" : "min-h-[132px]",
            )}
            ref={textareaRef}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
          />

          <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 sm:bottom-4 sm:left-4">
            {mode === "create" && !compact ? (
              <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-black/8 bg-black/5 p-1 backdrop-blur-sm">
                <div className="group/build relative">
                  <button
                    type="button"
                    onClick={() => setCreationMode("build")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                      creationMode === "build"
                        ? "bg-accent text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800"
                    )}
                  >
                    Build
                  </button>
                  {userData ? (
                    <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 hidden max-w-[80vw] -translate-x-1/2 whitespace-normal rounded-xl bg-zinc-900 px-3 py-2 text-center text-[11px] font-medium text-white shadow-lg group-hover/build:md:block">
                      Build tokens left: {buildRemaining}/{buildTokenLimit}
                      <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-zinc-900" />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setCreationMode("agent")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                    creationMode === "agent"
                      ? "bg-accent text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  Agent
                </button>
              </div>
            ) : null}

            {mode === "chat" && visualEditToggle && (
              <button
                type="button"
                onClick={visualEditToggle.onToggle}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-all duration-150",
                  visualEditToggle.active
                    ? "border-zinc-300 bg-zinc-900 text-white"
                    : "border-black/8 bg-black/5 text-zinc-500 hover:text-zinc-800"
                )}
              >
                {visualEditToggle.active ? "Visual Edit On" : "Visual Edit"}
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-8 rounded-full border border-black/8 bg-black/5 px-3 text-xs font-medium text-zinc-500 transition-all duration-150 hover:text-zinc-800",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400/40"
                  )}
                >
                  {autoMode ? "Auto" : getModelMeta(selectedModel).label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={10}
                avoidCollisions={false}
                className="max-h-[24rem] w-[23rem] overflow-y-auto overscroll-contain border-zinc-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl"
              >
                <DropdownMenuLabel className="px-2 pb-1 text-xs font-medium text-zinc-400">Response model</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => setAutoMode(true)}
                  className="rounded-xl border border-zinc-100 px-3 py-3 text-foreground focus:bg-zinc-50"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-900">Automatic</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Uses the default balanced model for the smoothest generation flow.
                      </p>
                    </div>
                    {autoMode ? <Check className="mt-0.5 h-4 w-4 text-zinc-900" /> : null}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-100" />
                {isPaidUser ? (
                  availableModels.map((model) => {
                    const meta = getModelMeta(model);
                    const isSelected = !autoMode && selectedModel === model;

                    return (
                      <DropdownMenuItem
                        key={model}
                        onSelect={() => {
                          setAutoMode(false);
                          setSelectedModel(model);
                        }}
                        className="rounded-xl border border-transparent px-3 py-3 text-foreground focus:border-zinc-100 focus:bg-zinc-50"
                      >
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-900">{meta.label}</span>
                              {meta.badges.slice(0, 2).map((badge) => (
                                <span
                                  key={`${model}-${badge}`}
                                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                              {meta.description}
                            </p>
                            <p className="mt-2 truncate text-[11px] text-zinc-400">{model}</p>
                          </div>
                          {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-900" /> : null}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <div className="px-2 py-2">
                    <p className="text-xs text-zinc-500">Custom model choice is available on paid plans.</p>
                    <Link href="/pricing" className="mt-2 inline-flex text-xs font-medium text-zinc-900 hover:underline">
                      Upgrade
                    </Link>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <motion.button
            type="button"
            className={cn(
              "absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex h-9 items-center justify-center gap-1.5 rounded-full transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-0",
              canStop
                ? "bg-zinc-900 px-3 text-white hover:bg-zinc-800 active:scale-95"
                : canSubmit
                ? "w-9 bg-zinc-900 text-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)] hover:bg-zinc-800 active:scale-95"
                : "w-9 bg-black/8 text-zinc-400 cursor-not-allowed"
            )}
            aria-label={canStop ? "Stop generating" : submitAriaLabel}
            title={canStop ? "Stop generating" : submitAriaLabel}
            disabled={!canSubmit && !canStop}
            onClick={canStop ? onStop : handleSubmit}
            whileTap={canSubmit || canStop ? { scale: 0.93 } : {}}
          >
            {canStop ? (
              <>
                <Square className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Stop</span>
              </>
            ) : isCreating || isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : submitLabel ? (
              <>
                <ArrowUp className="h-4 w-4" />
                <span className="text-xs font-medium">{submitLabel}</span>
              </>
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
