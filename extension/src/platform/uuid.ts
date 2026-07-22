import type { UuidProvider } from '../../../core/platform/interfaces'

export const uuidProvider: UuidProvider = {
  v4(): string {
    return crypto.randomUUID()
  },
}
