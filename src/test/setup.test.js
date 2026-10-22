import { describe, it, expect, vi } from 'vitest';
import { setReducedMotion, triggerIntersection, triggerResize } from './setup.js';

describe('test setup', () => {
  it('jest-dom matcher works: an appended element is in the document', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
  });

  it('recording canvas context records calls and property sets', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#fff';
    expect(ctx.calls).toContainEqual(['fillRect', 0, 0, 1, 1]);
    expect(ctx.sets).toContainEqual(['fillStyle', '#fff']);
  });

  it('canvas toDataURL returns a PNG data URL', () => {
    const canvas = document.createElement('canvas');
    expect(canvas.toDataURL()).toMatch(/^data:image\/png;base64,/);
  });

  it('matchMedia reflects reduced motion and notifies change listeners', () => {
    const query = '(prefers-reduced-motion: reduce)';
    const mq = window.matchMedia(query);
    const listener = vi.fn();
    mq.addEventListener('change', listener);

    expect(mq.matches).toBe(false);

    setReducedMotion(true);

    expect(window.matchMedia(query).matches).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setReducedMotion(false);
  });

  it('triggerIntersection and triggerResize call the observer callbacks', () => {
    const el = document.createElement('div');

    const ioCallback = vi.fn();
    const io = new IntersectionObserver(ioCallback);
    io.observe(el);
    triggerIntersection(el, true);
    expect(ioCallback.mock.calls[0][0]).toMatchObject([
      { target: el, isIntersecting: true },
    ]);

    const roCallback = vi.fn();
    const ro = new ResizeObserver(roCallback);
    ro.observe(el);
    triggerResize(el, { width: 300, height: 200 });
    expect(roCallback.mock.calls[0][0]).toMatchObject([
      { target: el, contentRect: { width: 300, height: 200 } },
    ]);
  });

  it('window.scrollTo is a mock function', () => {
    expect(vi.isMockFunction(window.scrollTo)).toBe(true);
  });

  it('localStorage writes in one test (part A)', () => {
    localStorage.setItem('x', '1');
    expect(localStorage.getItem('x')).toBe('1');
  });

  it('localStorage is cleared between tests (part B)', () => {
    expect(localStorage.getItem('x')).toBeNull();
  });

  it('document.fonts.ready resolves', async () => {
    await expect(document.fonts.ready).resolves.toBeUndefined();
  });
});
