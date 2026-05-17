<script lang="ts">
  import Header from './Header.svelte';
  import EventsTable from './EventsTable.svelte';
  import Toast from './Toast.svelte';
  import { QueryClient, QueryClientProvider, createMutation, createQuery } from '@tanstack/svelte-query';
  import type { SortingState } from '@tanstack/svelte-table';
  import { errorResponseSchema, paginatedEventsResponseSchema } from '../lib/validation';

  interface EventItem {
    id: number;
    title: string;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    created_by: string;
    created_at: string;
    group_name: string;
  }

  type SaveEventInput = {
    eventId?: string;
    body: Record<string, string>;
  };

  let {
    session = { fullName: '', username: '' },
    isAdmin = false,
    initialEvents = [],
    initialTotal = 0,
    initialPage = 1,
    pageSize = 10,
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
    userGroups?: string[];
    demo?: boolean;
    navLinks?: { href: string; label: string }[];
  } = $props();

  const STORAGE_KEY = 'demo_events';
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
  let editGroup = $state('');
  let editNotes = $state('');

  let dialogEl: HTMLDialogElement;
  let formEl: HTMLFormElement;

  let toastMsg = $state('');
  let toastType: 'success' | 'error' = 'success';
  let toastVisible = $state(false);

  let sorting = $state<SortingState>([]);

  let dialogTitle = $derived(editId !== null ? 'Edit Event' : 'Add Event');
  let submitLabel = $derived(editId !== null ? 'Save' : 'Add');

  async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
      const payload = await response.json();
      const parsed = errorResponseSchema.safeParse(payload);
      if (!parsed.success) return fallback;
      return typeof parsed.data.error === 'string' ? parsed.data.error : fallback;
    } catch {
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
    if (!parsed.success) throw new Error('Invalid events response');
    return parsed.data;
  }

  const eventsQuery = createQuery(() => ({
    queryKey: ['events', page, pageSize, search],
    enabled: !demo,
    refetchInterval: 5000,
    queryFn: () => requestPaginatedEvents(page, search),
    initialData: {
      events: initialEvents,
      total: initialTotal,
      page: initialPage,
      pageSize,
      totalPages: Math.max(Math.ceil(initialTotal / pageSize), 1),
    },
  }));

  const saveEventMutation = createMutation(() => ({
    mutationFn: async ({ eventId, body }: SaveEventInput) => {
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
      return { eventId };
    },
    onSuccess: async ({ eventId }) => {
      closeDialog();
      formEl?.reset();
      const hiddenId = formEl?.querySelector('input[name="event_id"]');
      if (hiddenId) hiddenId.remove();
      if (!eventId) {
        page = 1;
        search = '';
      }
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      showToast(eventId ? 'Event updated' : 'Event added');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to save event', 'error');
    },
  }));

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
  }));

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

  function canModify(createdBy: string): boolean {
    return isAdmin || createdBy === session.username;
  }

  function openAddDialog() {
    editId = null;
    editTitle = '';
    editStartDate = '';
    editEndDate = '';
    editGroup = userGroups[0] ?? 'default';
    editNotes = '';
    const ei = formEl?.querySelector('input[name="event_id"]');
    if (ei) ei.remove();
    dialogEl?.showModal();
  }

  function openEditDialog(ev: EventItem) {
    editId = ev.id;
    editTitle = ev.title;
    editStartDate = ev.start_date;
    editEndDate = ev.end_date ?? '';
    editGroup = ev.group_name;
    editNotes = ev.notes ?? '';
    dialogEl?.showModal();
  }

  function closeDialog() {
    dialogEl?.close();
  }

  async function handleSubmit() {
    const data = new FormData(formEl);
    const rawBody = Object.fromEntries(data.entries());
    const eventId = rawBody.event_id as string | undefined;

    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawBody)) {
      if (typeof value === 'string' && value.trim() === '') continue;
      if (key === 'event_id') continue;
      body[key] = value as string;
    }

    if (demo) {
      const now = new Date().toISOString();
      const eventData: EventItem = {
        id: eventId ? Number(eventId) : (Math.max(...allEvents.map(e => e.id), 0) + 1),
        title: body.title,
        start_date: body.start_date,
        end_date: body.end_date || null,
        notes: body.notes || null,
        group_name: body.group_name || 'General',
        created_by: session.username || 'demo',
        created_at: now,
      };
      if (eventId) {
        const idx = allEvents.findIndex(ev => ev.id === Number(eventId));
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

    await saveEventMutation.mutateAsync({ eventId, body });
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
    page = p;
    if (demo) applyDemoFilter();
  }

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
      onDelete={handleDelete}
      onSearch={onSearch}
      onPageChange={onPageChange}
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
          <label for="group_name">Group</label>
          {#if isAdmin || userGroups.length > 1}
            <input id="group_name" name="group_name" required maxlength="100" list="group-list" value={editGroup} oninput={(e) => editGroup = (e.target as HTMLInputElement).value} />
            <datalist id="group-list">
              {#each userGroups as g}
                <option value={g} />
              {/each}
            </datalist>
          {:else}
            <input id="group_name" name="group_name" required maxlength="100" readonly value={editGroup} />
          {/if}
        </div>
        <div class="field">
          <label for="notes">Notes <em>(Optional)</em></label>
          <textarea id="notes" name="notes" rows="2" maxlength="5000" value={editNotes} oninput={(e) => editNotes = (e.target as HTMLTextAreaElement).value}></textarea>
        </div>
      </div>
      <div class="dialog-actions">
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
  .field input, .field textarea {
    padding: .5rem; border: 1px solid #ccc; border-radius: 4px; font: inherit; font-size: .9rem;
  }
  .field textarea { resize: vertical; }

  .save-btn {
    padding: .6rem 1rem; background: #1a1a1a; color: #fff;
    border: none; border-radius: 4px; cursor: pointer; font: inherit;
  }
  .save-btn:hover { background: #333; }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: .45rem;
    margin-top: .9rem;
  }

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
