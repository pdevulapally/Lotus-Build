/** Default only an unset choice; never replace an explicit or pending model. */
export function resolveModelSelection(models: readonly string[], selectedModel: string): string {
  if (selectedModel) return models.includes(selectedModel) ? selectedModel : ''
  return models[0] ?? ''
}

/** Use the same server catalogue label everywhere, retaining unknown session IDs verbatim. */
export function modelLabel(models: readonly { id: string; name: string }[], modelId: string): string {
  return models.find((model) => model.id === modelId)?.name || modelId
}
