let lastPath = "";

export function trackPageview(path = window.location.pathname) {
  if (path === lastPath) return;
  lastPath = path;

  const payload = JSON.stringify({
    path,
    referrer: document.referrer || undefined,
    screenW: window.screen.width,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}
