<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import EventsTable from './EventsTable.svelte';
  import Toast from './Toast.svelte';
  import { QueryClient, QueryClientProvider, createMutation, createQuery } from '@tanstack/svelte-query';
  import type { SortingState } from '@tanstack/svelte-table';
  import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MIN_PAGE_SIZE,
    errorResponseSchema,
    paginatedEventsResponseSchema,
  } from '../lib/validation';
  import { logger } from '../lib/logging';

  interface GroupOption {
    id: number;
    name: string;
  }

  interface Tag {
    id: number;
    name: string;
  }

  interface Subject {
    id: number;
    name: string;
  }

  interface EventItem {
    id: number;
    title: string;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    created_by: string;
    created_at: string;
    group_id: number;
    group_name: string;
  }

  type EventMutationInput = {
    eventId?: number;
    body: Record<string, string>;
  };

  type EventMutationResult = {
    eventId: number;
    isNew: boolean;
  };

  let {
    session = { fullName: '', username: '' },
    isAdmin = false,
    initialEvents = [],
    initialTotal = 0,
    initialPage = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    initialSearch = '',
    userGroups = [],
    demo = false,
    navLinks = [{ href: '/timeline', label: 'Timeline view' }],
  }: {
    session: { fullName: string; username: string };
    isAdmin?: boolean;
    initialEvents?: EventItem[];
    initialTotal?: number;
    initialPage?: number;
    pageSize?: number;
    initialSearch?: string;
    userGroups?: GroupOption[];
    demo?: boolean;
    navLinks?: { href: string; label: string }[];
  } = $props();

  const STORAGE_KEY = 'demo_events';
  const REFETCH_INTERVAL_MS = 60000;
  const queryClient = new QueryClient();
  let allEvents: EventItem[] = $state([]);
  let events = $state(initialEvents);
  let total = $state(initialTotal);
  let page = $state(initialPage);
  let search = $state(initialSearch);
  let demoLoaded = $state(false);
  let lastQueryError = $state('');

  let editId = $state<number | null>(null);
  let editTitle = $state('');
  let editStartDate = $state('');
  let editEndDate = $state('');
  let editGroupId = $state<number | null>(null);
  let editNotes = $state('');

  let availableTags = $state<Tag[]>([]);
  let availableSubjects = $state<Subject[]>([]);
  let editTagIds = $state<Set<number>>(new Set());
  let editSubjectIds = $state<Set<number>>(new Set());

  let dialogEl: HTMLDialogElement;
  let formEl: HTMLFormElement;

  let toastMsg = $state('');
  let toastType: 'success' | 'error' = 'success';
  let toastVisible = $state(false);

  let sorting = $state<SortingState>([]);

  let dialogTitle = $derived(editId !== null ? 'Edit Event' : 'Add Event');
  let submitLabel = $derived(editId !== null ? 'Save' : 'Add');

  onMount(async () => {
    if (demo) return;
    try {
      const [tagsRes, subjectsRes] = await Promise.all([fetch('/api/tags'), fetch('/api/subjects')]);
      if (tagsRes.ok) availableTags = await tagsRes.json();
      if (subjectsRes.ok) availableSubjects = await subjectsRes.json();
    } catch {
      // non-critical; tags/subjects will remain empty
    }
  });

  async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
      const payload = await response.json();
      const parsed = errorResponseSchema.safeParse(payload);
      if (!parsed.success) {
        logger.warn('failed to parse API error payload', { fallback });
        return fallback;
      }
      return typeof parsed.data.error === 'string' ? parsed.data.error : fallback;
    } catch {
      logger.warn('failed to read API error payload', { fallback });
      return fallback;
    }
  }

  async function requestPaginatedEvents(pageNum: number, query: string) {
    const params = new URLSearchParams({
      page: String(pageNum),
      pageSize: String(pageSize),
      search: query,
    });
    const response = await fetch('/api/events?' + params.toString());
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to load events'));
    }
    const payload = await response.json();
    const parsed = paginatedEventsResponseSchema.safeParse(payload);
    if (!parsed.success) {
      logger.error('events response validation failed', {
        issues: JSON.stringify(parsed.error.issues),
      });
      throw new Error('Invalid events response');
    }
    return parsed.data;
  }

  const eventsQuery = createQuery(() => ({
    queryKey: ['events', page, pageSize, search],
    enabled: !demo,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    queryFn: () => requestPaginatedEvents(page, search),
    initialData: {
      events: initialEvents,
      total: initialTotal,
      page: initialPage,
      pageSize,
      totalPages: Math.max(Math.ceil(initialTotal / pageSize), 1),
    },
  }), () => queryClient);

  // Returns { eventId, isNew } — isNew is true when a new event was created (POST), false for updates (PUT).
  const saveEventMutation = createMutation(() => ({
    mutationFn: async ({ eventId, body }: EventMutationInput): Promise<EventMutationResult> => {
      const url = eventId ? `/api/events/${eventId}` : '/api/events';
      const method = eventId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Failed to save event'));
      }
      if (!eventId) {
        const data = await response.json();
        return { eventId: data.id as number, isNew: true };
      }
      return { eventId, isNew: false };
    },
    onSuccess: async ({ eventId, isNew }) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      showToast(isNew ? 'Event added' : 'Event updated');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to save event', 'error');
    },
  }), () => queryClient);

  const deleteEventMutation = createMutation(() => ({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Failed to delete event'));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      showToast('Event deleted');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to delete event', 'error');
    },
  }), () => queryClient);

  $effect(() => {
    if (demo && !demoLoaded && typeof window !== 'undefined') {
      const stored = loadDemoEvents();
      if (stored.length > 0) {
        allEvents = stored;
        total = stored.length;
        applyDemoFilter();
      }
      demoLoaded = true;
    }
  });

  $effect(() => {
    if (demo) return;
    const data = eventsQuery.data;
    if (!data) return;
    events = data.events;
    total = data.total;
    page = data.page;
    lastQueryError = '';
  });

  $effect(() => {
    if (demo) return;
    const error = eventsQuery.error;
    if (!(error instanceof Error)) return;
    if (error.message === lastQueryError) return;
    lastQueryError = error.message;
    showToast(error.message, 'error');
  });

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    toastVisible = true;
    setTimeout(() => { toastVisible = false; }, 3000);
  }

  function loadDemoEvents(): EventItem[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    const seed = (window as any).__DEMO_SEED__;
    if (seed) {
      saveDemoEvents(seed);
      return seed;
    }
    return [];
  }

  function saveDemoEvents(evts: EventItem[]) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(evts)); } catch {}
  }

  function clearEventIdInput() {
    const hiddenId = formEl?.querySelector('input[name="event_id"]');
    if (hiddenId) hiddenId.remove();
  }

  function canModify(createdBy: string): boolean {
    return isAdmin || createdBy === session.username;
  }

  function toggleTag(id: number) {
    const next = new Set(editTagIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    editTagIds = next;
  }

  function toggleSubject(id: number) {
    const next = new Set(editSubjectIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    editSubjectIds = next;
  }

  async function syncEventTags(eventId: number, selectedIds: Set<number>) {
    try {
      const res = await fetch(`/api/events/${eventId}/tags`);
      const currentTags: Tag[] = res.ok ? await res.json() : [];
      const currentIds = new Set(currentTags.map(t => t.id));
      const adds = [...selectedIds].filter(id => !currentIds.has(id));
      const removes = [...currentIds].filter(id => !selectedIds.has(id));
      await Promise.all([
        ...adds.map(id => fetch(`/api/events/${eventId}/tags`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tag_id: id }),
        })),
        ...removes.map(id => fetch(`/api/events/${eventId}/tags/${id}`, { method: 'DELETE' })),
      ]);
    } catch (err) {
      logger.warn('failed to sync event tags', { eventId: String(eventId), error: String(err) });
    }
  }

  async function syncEventSubjects(eventId: number, selectedIds: Set<number>) {
    try {
      const res = await fetch(`/api/events/${eventId}/subjects`);
      const currentSubjects: Subject[] = res.ok ? await res.json() : [];
      const currentIds = new Set(currentSubjects.map(s => s.id));
      const adds = [...selectedIds].filter(id => !currentIds.has(id));
      const removes = [...currentIds].filter(id => !selectedIds.has(id));
      await Promise.all([
        ...adds.map(id => fetch(`/api/events/${eventId}/subjects`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject_id: id }),
        })),
        ...removes.map(id => fetch(`/api/events/${eventId}/subjects/${id}`, { method: 'DELETE' })),
      ]);
    } catch (err) {
      logger.warn('failed to sync event subjects', { eventId: String(eventId), error: String(err) });
    }
  }

  function openAddDialog() {
    editId = null;
    editTitle = '';
    editStartDate = '';
    editEndDate = '';
    editGroupId = userGroups[0]?.id ?? null;
    editNotes = '';
    editTagIds = new Set();
    editSubjectIds = new Set();
    clearEventIdInput();
    dialogEl?.showModal();
  }

  async function openEditDialog(ev: EventItem) {
    editId = ev.id;
    editTitle = ev.title;
    editStartDate = ev.start_date;
    editEndDate = ev.end_date ?? '';
    editGroupId = ev.group_id;
    editNotes = ev.notes ?? '';
    editTagIds = new Set();
    editSubjectIds = new Set();
    dialogEl?.showModal();
    if (!demo) {
      try {
        const [tagsRes, subjectsRes] = await Promise.all([
          fetch(`/api/events/${ev.id}/tags`),
          fetch(`/api/events/${ev.id}/subjects`),
        ]);
        if (tagsRes.ok) {
          const tags: Tag[] = await tagsRes.json();
          editTagIds = new Set(tags.map(t => t.id));
        }
        if (subjectsRes.ok) {
          const subjects: Subject[] = await subjectsRes.json();
          editSubjectIds = new Set(subjects.map(s => s.id));
        }
      } catch (err) {
        logger.warn('failed to load event tags/subjects for edit', { eventId: String(ev.id), error: String(err) });
      }
    }
  }

  function closeDialog() {
    dialogEl?.close();
  }

  async function handleSubmit() {
    const data = new FormData(formEl);
    const rawBody = Object.fromEntries(data.entries());
    const eventIdRaw = rawBody.event_id as string | undefined;
    const eventId = eventIdRaw ? Number(eventIdRaw) : undefined;

    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawBody)) {
      if (typeof value === 'string' && value.trim() === '') continue;
      if (key === 'event_id') continue;
      body[key] = value as string;
    }

    if (demo) {
      const now = new Date().toISOString();
      const groupId = Number(body.group_id) || userGroups[0]?.id || 0;
      const groupName = userGroups.find(g => g.id === groupId)?.name ?? 'General';
      const eventData: EventItem = {
        id: eventId ?? (Math.max(...allEvents.map(e => e.id), 0) + 1),
        title: body.title,
        start_date: body.start_date,
        end_date: body.end_date || null,
        notes: body.notes || null,
        group_id: groupId,
        group_name: groupName,
        created_by: session.username || 'demo',
        created_at: now,
      };
      if (eventId) {
        const idx = allEvents.findIndex(ev => ev.id === eventId);
        if (idx !== -1) allEvents[idx] = eventData;
        showToast('Event updated');
      } else {
        allEvents.push(eventData);
        showToast('Event added');
      }
      saveDemoEvents(allEvents);
      closeDialog();
      page = 1;
      search = '';
      applyDemoFilter();
      return;
    }

    const capturedTagIds = new Set(editTagIds);
    const capturedSubjectIds = new Set(editSubjectIds);

    const result = await saveEventMutation.mutateAsync({ eventId, body });
    closeDialog();
    formEl?.reset();
    clearEventIdInput();
    if (result.isNew) {
      page = 1;
      search = '';
    }
    await syncEventTags(result.eventId, capturedTagIds);
    await syncEventSubjects(result.eventId, capturedSubjectIds);
  }

  function applyDemoFilter() {
    const filtered = search
      ? allEvents.filter(ev => {
          const q = search.toLowerCase();
          return ev.title.toLowerCase().includes(q) || (ev.notes ?? '').toLowerCase().includes(q);
        })
      : [...allEvents];
    total = filtered.length;
    const start = (page - 1) * pageSize;
    events = filtered.slice(start, start + pageSize);
  }

  function onSearch(value: string) {
    search = value;
    page = 1;
    if (demo) applyDemoFilter();
  }

  function onPageChange(p: number) {
    page = Math.max(1, p);
    if (demo) applyDemoFilter();
  }

  function onPageSizeChange(nextPageSize: number) {
    if (!Number.isInteger(nextPageSize) || nextPageSize < MIN_PAGE_SIZE || nextPageSize > MAX_PAGE_SIZE) return;
    if (nextPageSize === pageSize) return;
    pageSize = nextPageSize;
    page = 1;
    if (demo) applyDemoFilter();
  }

  $effect(() => {
    if (typeof window === 'undefined' || demo) return;
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    window.history.replaceState({}, '', nextUrl);
  });

  async function handleDelete(evId: number, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    if (demo) {
      allEvents = allEvents.filter(ev => ev.id !== evId);
      saveDemoEvents(allEvents);
      showToast('Event deleted');
      applyDemoFilter();
      return;
    }
    await deleteEventMutation.mutateAsync(evId);
  }
</script>

<QueryClientProvider client={queryClient}>
  <Header {session} {isAdmin} navLinks={demo ? [{ href: '/demo/timeline', label: 'Timeline view' }] : navLinks} />

  <button class="add-fab" type="button" onclick={openAddDialog} aria-label="Add event">+</button>

  <div class="content">
    <EventsTable
      {events}
      {total}
      {page}
      {pageSize}
      {search}
      canModify={canModify}
      onEdit={openEditDialog}
      onSearch={onSearch}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      bind:sorting
    />
  </div>

  <dialog bind:this={dialogEl} class="event-dialog">
    <form bind:this={formEl} method="dialog" onsubmit={handleSubmit}>
      {#if editId !== null}
        <input type="hidden" name="event_id" value={editId} />
      {/if}
      <div class="dialog-head">
        <h2>{dialogTitle}</h2>
        <button class="icon-btn" type="button" onclick={closeDialog} aria-label="Close">×</button>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="title">Title</label>
          <input id="title" name="title" required maxlength="200" value={editTitle} oninput={(e) => editTitle = (e.target as HTMLInputElement).value} />
        </div>
        <div class="field">
          <label for="start_date">Start Date</label>
          <input id="start_date" name="start_date" type="date" required value={editStartDate} oninput={(e) => editStartDate = (e.target as HTMLInputElement).value} />
        </div>
        <div class="field">
          <label for="end_date">End Date <em>(Optional)</em></label>
          <input id="end_date" name="end_date" type="date" value={editEndDate} oninput={(e) => editEndDate = (e.target as HTMLInputElement).value} />
        </div>
        <div class="field">
          <label for="group_id">Group</label>
          <select id="group_id" name="group_id" required>
            {#each userGroups as g}
              <option value={g.id} selected={editGroupId === g.id}>{g.name}</option>
            {/each}
          </select>
        </div>
        {#if !demo && availableTags.length > 0}
          <div class="field">
            <label>Tags <em>(Optional)</em></label>
            <div class="chip-group">
              {#each availableTags as tag}
                <label class="chip-label">
                  <input type="checkbox" checked={editTagIds.has(tag.id)} onchange={() => toggleTag(tag.id)} />
                  {tag.name}
                </label>
              {/each}
            </div>
          </div>
        {/if}
        {#if !demo && availableSubjects.length > 0}
          <div class="field">
            <label>Subjects <em>(Optional)</em></label>
            <div class="chip-group">
              {#each availableSubjects as subject}
                <label class="chip-label">
                  <input type="checkbox" checked={editSubjectIds.has(subject.id)} onchange={() => toggleSubject(subject.id)} />
                  {subject.name}
                </label>
              {/each}
            </div>
          </div>
        {/if}
        <div class="field">
          <label for="notes">Notes <em>(Optional)</em></label>
          <textarea id="notes" name="notes" rows="2" maxlength="5000" value={editNotes} oninput={(e) => editNotes = (e.target as HTMLTextAreaElement).value}></textarea>
        </div>
      </div>
      <div class="dialog-actions">
        {#if editId !== null}
          <button class="delete-btn" type="button" onclick={() => handleDelete(editId, editTitle)}>Delete event</button>
        {/if}
        <button class="cancel-btn" type="button" onclick={closeDialog}>Cancel</button>
        <button class="save-btn" type="submit">{submitLabel}</button>
      </div>
    </form>
  </dialog>

  <Toast visible={toastVisible} type={toastType} message={toastMsg} />
</QueryClientProvider>

<style>
  .add-fab {
    position: fixed;
    bottom: max(1rem, env(safe-area-inset-bottom));
    right: max(1rem, env(safe-area-inset-right));
    width: 3rem;
    height: 3rem;
    border: none;
    border-radius: 999px;
    background: #1a1a1a;
    color: #fff;
    font-size: 1.8rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 10px 28px rgba(0,0,0,.28);
    z-index: 50;
  }
  .add-fab:hover { background: #333; }

  .content { padding: .5rem 0 4rem; }

  dialog.event-dialog {
    margin: auto;
    border: none;
    border-radius: 12px;
    padding: 1rem;
    width: min(100% - 1.5rem, 420px);
    box-shadow: 0 16px 40px rgba(0,0,0,.26);
  }

  dialog.event-dialog::backdrop { background: rgba(0,0,0,.45); }

  .dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: .9rem;
  }
  .dialog-head h2 { font-size: 1.05rem; }

  .icon-btn {
    border: 1px solid #d0d0d0;
    background: #fff;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .icon-btn:hover { background: #f5f5f5; }

  .form-grid {
    display: grid;
    gap: .8rem;
  }

  .field { display: flex; flex-direction: column; gap: .3rem; }
  .field label { font-size: .8rem; font-weight: 600; color: #555; }
  .field input, .field textarea, .field select {
    padding: .5rem; border: 1px solid #ccc; border-radius: 4px; font: inherit; font-size: 1rem;
  }
  .field textarea { resize: vertical; }

  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: .35rem;
  }
  .chip-label {
    display: inline-flex;
    align-items: center;
    gap: .25rem;
    font-size: .8rem;
    font-weight: normal !important;
    color: #333;
    background: #f3f3f3;
    border: 1px solid #ddd;
    border-radius: 999px;
    padding: .2rem .6rem;
    cursor: pointer;
  }
  .chip-label input[type="checkbox"] { margin: 0; accent-color: #1a1a1a; }

  .save-btn {
    padding: .6rem 1rem; background: #1a1a1a; color: #fff;
    border: none; border-radius: 4px; cursor: pointer; font: inherit;
  }
  .save-btn:hover { background: #333; }

  .dialog-actions {
    display: flex;
    justify-content: space-between;
    gap: .45rem;
    margin-top: .9rem;
  }

  .delete-btn {
    border: 1px solid #f1d1d1;
    background: #fff;
    color: #b10000;
    border-radius: 4px;
    padding: .6rem .9rem;
    font: inherit;
    cursor: pointer;
  }
  .delete-btn:hover { background: #fff1f1; }

  .cancel-btn {
    border: 1px solid #d0d0d0;
    background: #fff;
    color: #444;
    border-radius: 4px;
    padding: .6rem .9rem;
    font: inherit;
    cursor: pointer;
  }
  .cancel-btn:hover { background: #f5f5f5; }

  @media (min-width: 768px) {
    .add-fab {
      top: 1.25rem;
      right: 1.25rem;
      bottom: auto;
    }
  }
</style>
