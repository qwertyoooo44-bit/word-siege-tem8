export function registerPwa(onUpdate: () => void): void {
  if (!('serviceWorker' in navigator)) return
  const swUrl = `${import.meta.env.BASE_URL}sw.js`
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(swUrl).then((reg) => {
      if (reg.waiting) onUpdate()
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate()
        })
      })
    })
  })
}

export async function applyUpdate(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  reg?.waiting?.postMessage('SKIP_WAITING')
  window.location.reload()
}
