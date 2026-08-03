(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  requestAnimationFrame(() => root.classList.add("is-ready"));

  const reveals = [...document.querySelectorAll("[data-reveal]")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10%", threshold: 0.1 },
    );
    reveals.forEach((element) => observer.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add("is-visible"));
  }

  const progress = document.querySelector(".scroll-progress span");
  let framePending = false;

  function renderScrollProgress() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    progress?.style.setProperty("--scroll-progress", ratio);
    framePending = false;
  }

  window.addEventListener("scroll", () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(renderScrollProgress);
  }, { passive: true });
  renderScrollProgress();

  document.querySelectorAll("[data-count]").forEach((counter) => {
    const target = Number(counter.dataset.count);
    if (!Number.isFinite(target) || target === 0 || reducedMotion.matches) return;
    counter.textContent = "0";
    const startedAt = performance.now();
    const duration = 720;

    function tick(now) {
      const ratio = Math.min((now - startedAt) / duration, 1);
      counter.textContent = String(Math.round(target * (1 - Math.pow(1 - ratio, 3))));
      if (ratio < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const copyButton = document.querySelector(".copy-command");
  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
      copyButton.textContent = "COPIED";
      copyButton.classList.add("is-copied");
      window.setTimeout(() => {
        copyButton.textContent = "COPY";
        copyButton.classList.remove("is-copied");
      }, 1600);
    } catch {
      copyButton.textContent = "SELECT COMMAND";
    }
  });
})();
