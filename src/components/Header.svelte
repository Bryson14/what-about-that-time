<script lang="ts">
  import { mount } from 'svelte';

  let { session, isAdmin, title = 'What About That Time', titleHref = '/app', navLinks = [], variant = 'light' }: {
    session: { fullName: string; username: string };
    isAdmin: boolean;
    title?: string;
    titleHref?: string;
    navLinks?: { href: string; label: string }[];
    variant?: 'light' | 'dark';
  } = $props();

  let mobileOpen = $state(false);

  function toggleMenu() {
    mobileOpen = !mobileOpen;
  }

  function closeMenu() {
    mobileOpen = false;
  }
</script>

<div class="header-wrap" data-variant={variant}>
  <header class="header">
    <a href={titleHref} class="title">{title}</a>

    <nav class="nav-desktop">
      <span class="user-chip">{session.fullName} (@{session.username})</span>
      {#if isAdmin}
        <a href="/admin" class="nav-btn">Admin</a>
      {/if}
      {#each navLinks as link}
        <a href={link.href} class="nav-btn">{link.label}</a>
      {/each}
      <form method="POST" action="/api/logout" style="display:contents">
        <button class="nav-btn" type="submit">Sign out</button>
      </form>
    </nav>

    <button class="hamburger" type="button" onclick={toggleMenu} aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  </header>

  {#if mobileOpen}
    <div class="mobile-menu open" onclick={(e) => { if (e.target === e.currentTarget) closeMenu(); }}>
      <div class="mobile-menu-inner">
        <button class="mobile-close" type="button" onclick={closeMenu} aria-label="Close menu">&times;</button>
        <span class="user-chip">{session.fullName} (@{session.username})</span>
        {#if isAdmin}
          <a href="/admin" class="mobile-nav-btn">Admin</a>
        {/if}
        {#each navLinks as link}
          <a href={link.href} class="mobile-nav-btn">{link.label}</a>
        {/each}
        <form method="POST" action="/api/logout" style="display:contents">
          <button class="mobile-nav-btn" type="submit">Sign out</button>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  * { box-sizing: border-box; }

  .header-wrap[data-variant="light"] {
    --h-text: #1a1a1a;
    --h-btn-bg: none;
    --h-btn-border: #ccc;
    --h-btn-color: #555;
    --h-btn-hover-bg: #f0f0f0;
    --h-btn-radius: 4px;
    --h-btn-padding: 0.35rem 0.85rem;
    --h-btn-font-size: 0.85rem;
    --h-chip-bg: #fff;
    --h-chip-border: #ddd;
    --h-chip-color: #555;
    --h-chip-padding: 0.3rem 0.75rem;
    --h-chip-font-size: 0.8rem;
    --h-hamburger-color: #333;
    --h-mobile-bg: #fafafa;
    --h-mobile-btn-bg: #fff;
    --h-mobile-btn-border: #ddd;
    --h-mobile-btn-color: #333;
    --h-mobile-btn-hover-bg: #f0f0f0;
    --h-close-color: #333;
  }

  .header-wrap[data-variant="dark"] {
    --h-text: #ccc;
    --h-btn-bg: rgba(255, 255, 255, 0.04);
    --h-btn-border: rgba(255, 255, 255, 0.1);
    --h-btn-color: #999;
    --h-btn-hover-bg: rgba(255, 255, 255, 0.08);
    --h-btn-radius: 6px;
    --h-btn-padding: 0.3rem 0.7rem;
    --h-btn-font-size: 0.78rem;
    --h-chip-bg: rgba(255, 255, 255, 0.03);
    --h-chip-border: rgba(255, 255, 255, 0.12);
    --h-chip-color: #888;
    --h-chip-padding: 0.25rem 0.65rem;
    --h-chip-font-size: 0.75rem;
    --h-hamburger-color: #999;
    --h-mobile-bg: #080c14;
    --h-mobile-btn-bg: rgba(255, 255, 255, 0.04);
    --h-mobile-btn-border: rgba(255, 255, 255, 0.1);
    --h-mobile-btn-color: #ccc;
    --h-mobile-btn-hover-bg: rgba(255, 255, 255, 0.08);
    --h-close-color: #999;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    gap: 0.5rem;
  }

  .header-wrap[data-variant="dark"] .header {
    background: linear-gradient(180deg, #0d1525 0%, #0a0e17 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .title {
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    font-size: 1.1rem;
    color: var(--h-text);
  }

  .header-wrap[data-variant="dark"] .title {
    font-size: 1rem;
    letter-spacing: 0.02em;
  }

  .nav-desktop {
    display: none;
    gap: 0.5rem;
    align-items: center;
  }

  .nav-btn {
    padding: var(--h-btn-padding);
    font-size: var(--h-btn-font-size);
    background: var(--h-btn-bg);
    border: 1px solid var(--h-btn-border);
    border-radius: var(--h-btn-radius);
    color: var(--h-btn-color);
    font: inherit;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: all 0.15s;
  }

  .nav-btn:hover {
    background: var(--h-btn-hover-bg);
  }

  .header-wrap[data-variant="dark"] .nav-btn:hover {
    color: #ccc;
  }

  .user-chip {
    border: 1px solid var(--h-chip-border);
    border-radius: 999px;
    padding: var(--h-chip-padding);
    font-size: var(--h-chip-font-size);
    color: var(--h-chip-color);
    background: var(--h-chip-bg);
    white-space: nowrap;
  }

  .hamburger {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
  }

  .hamburger span {
    display: block;
    width: 22px;
    height: 2px;
    border-radius: 2px;
    background: var(--h-hamburger-color);
  }

  .mobile-menu {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--h-mobile-bg);
    transform: translateY(100%);
    transition: transform 0.25s ease-out;
    display: flex;
  }

  .mobile-menu.open {
    transform: translateY(0);
  }

  .mobile-menu-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    width: 100%;
    padding: 2rem;
  }

  .mobile-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.75rem;
    cursor: pointer;
    padding: 0.5rem;
    color: var(--h-close-color);
    line-height: 1;
  }

  .mobile-nav-btn {
    display: block;
    width: 100%;
    max-width: 320px;
    padding: 1rem 1.25rem;
    text-align: center;
    font: inherit;
    font-size: 1.1rem;
    border-radius: 8px;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid var(--h-mobile-btn-border);
    background: var(--h-mobile-btn-bg);
    color: var(--h-mobile-btn-color);
    transition: background 0.15s;
  }

  .mobile-nav-btn:hover {
    background: var(--h-mobile-btn-hover-bg);
  }

  .mobile-menu .user-chip {
    font-size: 0.95rem;
    padding: 0.4rem 1rem;
    margin-bottom: 0.25rem;
  }

  @media (min-width: 768px) {
    .nav-desktop {
      display: flex;
    }
    .hamburger {
      display: none;
    }
    .header {
      padding: 0.6rem 1.5rem;
    }
  }
</style>
