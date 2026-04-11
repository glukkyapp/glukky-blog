import { useEffect } from "react";

export function useBounceScroll() {
  useEffect(() => {
    let startY = 0;
    let currentTranslate = 0;
    let isDragging = false;
    const maxBounce = 80;
    const resistance = 0.35;
    const el = document.documentElement;

    const isAtTop = () => window.scrollY <= 0;
    const isAtBottom = () =>
      window.scrollY + window.innerHeight >= document.body.scrollHeight - 1;

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isDragging = false;
      currentTranslate = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - startY;

      if (deltaY > 0 && isAtTop()) {
        isDragging = true;
        currentTranslate = Math.min(deltaY * resistance, maxBounce);
        el.style.transform = `translateY(${currentTranslate}px)`;
        el.style.transition = "none";
      } else if (deltaY < 0 && isAtBottom()) {
        isDragging = true;
        currentTranslate = Math.max(deltaY * resistance, -maxBounce);
        el.style.transform = `translateY(${currentTranslate}px)`;
        el.style.transition = "none";
      } else if (!isDragging) {
        startY = e.touches[0].clientY;
      }
    };

    const onTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      currentTranslate = 0;
      el.style.transition = "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      el.style.transform = "translateY(0)";
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      el.style.transform = "";
      el.style.transition = "";
    };
  }, []);
}
