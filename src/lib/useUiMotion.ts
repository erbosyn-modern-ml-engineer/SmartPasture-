import { useEffect, useState, type RefObject } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()

    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return prefersReducedMotion
}

export function useRevealOnScroll(containerRef: RefObject<HTMLElement | null>, dependencyKey: string) {
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!targets.length) {
      return
    }

    targets.forEach((target, index) => {
      target.classList.add('reveal-ready')

      const parsedDelay = Number(target.dataset.revealDelay)
      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        target.style.setProperty('--reveal-delay', `${parsedDelay}ms`)
      } else {
        target.style.setProperty('--reveal-delay', `${Math.min(index * 45, 180)}ms`)
      }
    })

    if (prefersReducedMotion || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -12% 0px',
      },
    )

    targets.forEach((target) => {
      if (!target.classList.contains('is-visible')) {
        observer.observe(target)
      }
    })

    return () => observer.disconnect()
  }, [containerRef, dependencyKey, prefersReducedMotion])
}
