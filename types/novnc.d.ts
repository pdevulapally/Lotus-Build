declare module '@novnc/novnc' {
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: { wsProtocols?: string[] })
    viewOnly: boolean
    scaleViewport: boolean
    disconnect(): void
    addEventListener(type: string, listener: EventListener): void
    _sock?: { _websocket?: WebSocket | null }
  }
}
