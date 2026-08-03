(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reveals = [...document.querySelectorAll("[data-reveal]")];

  requestAnimationFrame(() => root.classList.add("is-ready"));

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12%", threshold: 0.12 },
    );
    reveals.forEach((element) => revealObserver.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add("is-visible"));
  }

  const progress = document.querySelector(".scroll-progress span");
  const parallaxImage = document.querySelector("[data-parallax]");
  let framePending = false;

  function renderScrollEffects() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    progress?.style.setProperty("--scroll-progress", ratio);

    if (parallaxImage && !reducedMotion.matches) {
      const rect = parallaxImage.parentElement.getBoundingClientRect();
      const viewportOffset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      parallaxImage.style.setProperty("--parallax-y", `${Math.max(-18, Math.min(18, viewportOffset * -24))}px`);
    }
    framePending = false;
  }

  function requestScrollFrame() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(renderScrollEffects);
  }

  window.addEventListener("scroll", requestScrollFrame, { passive: true });
  window.addEventListener("resize", requestScrollFrame, { passive: true });
  renderScrollEffects();

  document.querySelectorAll(".spotlight-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    });
  });

  const tilt = document.querySelector("[data-tilt]");
  if (tilt) {
    tilt.addEventListener("pointermove", (event) => {
      if (reducedMotion.matches || event.pointerType === "touch") return;
      const rect = tilt.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      tilt.style.setProperty("--tilt-x", `${y * -3.2}deg`);
      tilt.style.setProperty("--tilt-y", `${x * 4.4}deg`);
    });
    tilt.addEventListener("pointerleave", () => {
      tilt.style.setProperty("--tilt-x", "0deg");
      tilt.style.setProperty("--tilt-y", "0deg");
    });
  }

  document.querySelectorAll("[data-count]").forEach((counter) => {
    const target = Number(counter.dataset.count);
    if (!Number.isFinite(target) || target === 0 || reducedMotion.matches) return;
    counter.textContent = "0";
    const startedAt = performance.now();
    const duration = 900;
    function tick(now) {
      const progressRatio = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progressRatio, 3);
      counter.textContent = String(Math.round(target * eased));
      if (progressRatio < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const copyButton = document.querySelector(".copy-command");
  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
      copyButton.textContent = "Copied";
      copyButton.classList.add("is-copied");
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
        copyButton.classList.remove("is-copied");
      }, 1800);
    } catch {
      copyButton.textContent = "Select command";
    }
  });
})();
