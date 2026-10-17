/** Unported features fail before making a request to the retired backend. */
export async function unavailableFeature(feature: string): Promise<Response> {
  throw new Error(`${feature} is not supported by the current LotusBuild server. This feature has not been migrated.`)
}
