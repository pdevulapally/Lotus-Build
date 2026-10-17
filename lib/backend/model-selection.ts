/** Default only an unset choice; never replace an explicit or pending model. */
export function resolveModelSelection(models: readonly string[], selectedModel: string): string {
  if (selectedModel) return models.includes(selectedModel) ? selectedModel : ''
  return models[0] ?? ''
}
