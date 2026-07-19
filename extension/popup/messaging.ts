export function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message)
}
