<script lang="ts">
  import { createTable, FlexRender, createColumnHelper, stockFeatures, createCoreRowModel, createSortedRowModel } from '@tanstack/svelte-table';
  import type { SortingState } from '@tanstack/svelte-table';

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

  const columnHelper = createColumnHelper<EventItem>();

  const columns = [
    columnHelper.accessor('title', { header: 'Title', enableSorting: true }),
    columnHelper.accessor('start_date', { header: 'Start', enableSorting: true }),
    columnHelper.accessor('end_date', {
      header: 'End',
      enableSorting: true,
      cell: (info) => info.getValue() ?? '—',
    }),
    columnHelper.accessor('group_name', { header: 'Group', enableSorting: true }),
    columnHelper.accessor('created_by', { header: 'Added By', enableSorting: true }),
    columnHelper.accessor('notes', {
      header: 'Notes',
      enableSorting: false,
      cell: (info) => info.getValue() ?? '',
    }),
    columnHelper.display({ id: 'actions', header: '' }),
  ];

  let {
    events = [],
    total = 0,
    page = 1,
    pageSize = 10,
    search = '',
    canModify = (_createdBy: string) => false,
    onEdit = (_ev: EventItem) => {},
    onDelete = (_id: number, _title: string) => {},
    onSearch = (_value: string) => {},
    onPageChange = (_page: number) => {},
    onPageSizeChange = (_pageSize: number) => {},
    sorting = [],
    onSortingChange = (_updater: SortingState | ((old: SortingState) => SortingState)) => {},
  }: {
    events?: EventItem[];
    total?: number;
    page?: number;
    pageSize?: number;
    search?: string;
    canModify?: (createdBy: string) => boolean;
    onEdit?: (ev: EventItem) => void;
    onDelete?: (id: number, title: string) => void;
    onSearch?: (value: string) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    sorting?: SortingState;
    onSortingChange?: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  } = $props();

  let openMenuId = $state<number | null>(null);

  let totalPages = $derived(Math.ceil(total / pageSize) || 1);
  let startEntry = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
  let endEntry = $derived(Math.min(page * pageSize, total));

  let pageNumbers = $derived.by(() => {
    const nums: (number | '…')[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages <= 7 || p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
        nums.push(p);
      } else if (nums[nums.length - 1] !== '…') {
        nums.push('…');
      }
    }
    return nums;
  });

  const table = createTable({
    _features: stockFeatures,
    _rowModels: {
      getCoreRowModel: createCoreRowModel(),
      getSortedRowModel: createSortedRowModel(),
    },
    columns,
    data: events,
    state: {
      columnVisibility: {},
      columnOrder: [],
      columnPinning: { left: [], right: [] },
      rowPinning: { top: [], bottom: [] },
      columnFilters: [],
      globalFilter: undefined,
      sorting,
      grouping: [],
      expanded: {},
      columnSizing: {},
      columnSizingInfo: {
        startOffset: null, startSize: null, deltaOffset: null,
        deltaPercentage: null, isResizingColumn: false, columnSizingStart: [],
      },
      pagination: { pageIndex: 0, pageSize: 10 },
      rowSelection: {},
    },
    onSortingChange: (updater) => {
      onSortingChange(updater as SortingState | ((old: SortingState) => SortingState));
    },
  });

  let headerGroups = $derived(table.getHeaderGroups());
  let rows = $derived(table.getRowModel().rows);

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  function onSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => onSearch(value), 300);
  }

  function onPageSizeSelect(e: Event) {
    const next = Number((e.target as HTMLSelectElement).value);
    if (!Number.isInteger(next) || next < 1) return;
    onPageSizeChange(next);
  }

  function toggleMenu(evId: number) {
    openMenuId = openMenuId === evId ? null : evId;
  }

  function closeMenus() {
    openMenuId = null;
  }

  const MAX_NOTE_PREVIEW_LENGTH = 50;
</script>

<svelte:window onclick={() => { if (openMenuId !== null) closeMenus(); }} />

<div class="table-toolbar">
  <input
    type="search"
    placeholder="Search events..."
    value={search}
    oninput={onSearchInput}
    class="search-input"
    autocomplete="off"
  />
  <label class="page-size-label">
    Rows
    <select class="page-size-select" value={String(pageSize)} onchange={onPageSizeSelect}>
      <option value="10">10</option>
      <option value="25">25</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>
  </label>
  <span class="range-info">{total === 0 ? 'No results' : `${startEntry}–${endEntry} of ${total}`}</span>
</div>

<div class="table-shell">
  <table>
    <thead>
      <tr>
        {#each headerGroups[0]?.headers ?? [] as header (header.id)}
          <th class:sortable={header.column.getCanSort()} onclick={header.column.getToggleSortingHandler()}>
            <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
            {#if header.column.getIsSorted()}
              <span class="sort-arrow">{header.column.getIsSorted() === 'asc' ? ' ▲' : ' ▼'}</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if rows.length === 0}
        <tr><td colspan={7} class="empty">{search ? 'No matching events' : 'No events yet'}</td></tr>
      {:else}
        {#each rows as row (row.original.id)}
          {@const ev = row.original}
          <tr data-id={ev.id}>
            {#each row.getVisibleCells() as cell (cell.id)}
              {#if cell.column.id === 'actions'}
                <td class="actions">
                  {#if canModify(ev.created_by)}
                    <div class="menu">
                      <button class="menu-trigger" type="button" onclick={(e) => { e.stopPropagation(); toggleMenu(ev.id); }} aria-label="Open actions menu">⋯</button>
                      {#if openMenuId === ev.id}
                        <div class="menu-panel" onclick={(e) => e.stopPropagation()}>
                          <button class="edit" type="button" onclick={() => { closeMenus(); onEdit(ev); }}>Edit</button>
                          <button class="delete" type="button" onclick={() => { closeMenus(); onDelete(ev.id, ev.title); }}>Delete</button>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </td>
              {:else if cell.column.id === 'title'}
                <td><strong><FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} /></strong></td>
              {:else if cell.column.id === 'notes'}
                <td class="notes"><FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} /></td>
              {:else if cell.column.id === 'end_date'}
                <td><FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} /></td>
              {:else}
                <td><FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} /></td>
              {/if}
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<div class="card-list">
  {#if rows.length === 0}
    <p class="empty-cards">{search ? 'No matching events' : 'No events yet'}</p>
  {:else}
    {#each rows as row (row.original.id)}
      {@const ev = row.original}
      <div class="event-card">
        <div class="card-header">
          <strong class="card-title">{ev.title}</strong>
          {#if canModify(ev.created_by)}
            <div class="menu">
              <button class="menu-trigger" type="button" onclick={(e) => { e.stopPropagation(); toggleMenu(ev.id); }} aria-label="Open actions menu">⋯</button>
              {#if openMenuId === ev.id}
                <div class="menu-panel" onclick={(e) => e.stopPropagation()}>
                  <button class="edit" type="button" onclick={() => { closeMenus(); onEdit(ev); }}>Edit</button>
                  <button class="delete" type="button" onclick={() => { closeMenus(); onDelete(ev.id, ev.title); }}>Delete</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        {#if ev.notes}
          <p class="card-notes">{ev.notes.length > MAX_NOTE_PREVIEW_LENGTH ? ev.notes.slice(0, MAX_NOTE_PREVIEW_LENGTH) + '…' : ev.notes}</p>
        {/if}
        <div class="card-meta">
          <span class="meta-item" aria-label="Added by: {ev.created_by}">👤 {ev.created_by}</span>
          <span class="meta-item" aria-label="Group: {ev.group_name}">📁 {ev.group_name}</span>
          <span class="meta-item" aria-label="Date: {ev.start_date}{ev.end_date ? ` to ${ev.end_date}` : ''}">📅 {ev.start_date}{ev.end_date ? ` – ${ev.end_date}` : ''}</span>
        </div>
      </div>
    {/each}
  {/if}
</div>

<div class="pagination">
  <button class="page-btn" onclick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">&laquo;</button>
  {#each pageNumbers as p}
    {#if p === '…'}
      <span class="page-ellipsis">…</span>
    {:else}
      <button class="page-btn" class:active={p === page} onclick={() => onPageChange(p)}>{p}</button>
    {/if}
  {/each}
  <button class="page-btn" onclick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">&raquo;</button>
</div>

<style>
  .table-toolbar {
    display: flex;
    align-items: center;
    gap: .75rem;
    margin-bottom: .75rem;
    flex-wrap: wrap;
  }

  .search-input {
    padding: .45rem .65rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font: inherit;
    font-size: 1rem;
    min-width: 200px;
  }

  .range-info {
    font-size: .85rem;
    color: #777;
  }

  .page-size-label {
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    font-size: .85rem;
    color: #555;
  }

  .page-size-select {
    padding: .35rem .5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font: inherit;
    font-size: 1rem;
    background: #fff;
    color: #1a1a1a;
  }

  .table-shell {
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
    background: #fff;
    display: flex;
    justify-content: center;
    padding-bottom: 2.5rem;
  }

  table {
    width: auto;
    min-width: 680px;
    border-collapse: collapse;
  }

  th, td {
    text-align: left;
    padding: .75rem;
    border-bottom: 1px solid #eee;
  }

  th { background: #f0f0f0; font-weight: 600; user-select: none; }
  th.sortable { cursor: pointer; }
  th.sortable:hover { background: #e5e5e5; }
  .sort-arrow { font-size: .75rem; }

  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: #888;
  }

  .notes { color: #555; font-size: .9em; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .3rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .page-btn {
    padding: .35rem .65rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    font-size: .85rem;
    color: #444;
  }

  .page-btn:hover:not(:disabled):not(.active) { background: #f0f0f0; }
  .page-btn:disabled { opacity: .4; cursor: default; }
  .page-btn.active {
    background: #1a1a1a;
    color: #fff;
    border-color: #1a1a1a;
  }

  .page-ellipsis {
    padding: .35rem .25rem;
    color: #999;
  }

  /* Desktop: show cards, hide table */
  @media (min-width: 768px) {
    .table-shell { display: none; }
  }

  /* Mobile: hide table, show cards */
  @media (max-width: 767px) {
    .table-shell { display: none; }
  }

  .card-list {
    display: flex;
    flex-direction: column;
    gap: .6rem;
    max-width: 100%;
    overflow-x: hidden;
  }

  .event-card {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
    padding: .75rem .85rem;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: .5rem;
    margin-bottom: .35rem;
  }

  .card-title {
    font-size: 1rem;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .card-notes {
    font-size: .85rem;
    color: #555;
    margin: 0 0 .45rem;
    line-height: 1.4;
  }

  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: .35rem .6rem;
  }

  .meta-item {
    font-size: .72rem;
    color: #777;
    background: #f3f3f3;
    border-radius: 4px;
    padding: .15rem .35rem;
    white-space: normal;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

  .empty-cards {
    text-align: center;
    padding: 2rem 1rem;
    color: #888;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
  }

  .actions {
    width: 68px;
    position: relative;
  }

  .menu {
    position: relative;
    display: flex;
    justify-content: flex-end;
  }

  .menu-trigger {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    border: 1px solid #d7d7d7;
    background: #fff;
    cursor: pointer;
    font-size: 1.15rem;
    line-height: 1;
  }
  .menu-trigger:hover { background: #f5f5f5; }

  .menu-panel {
    position: absolute;
    top: calc(100% + .25rem);
    right: 0;
    min-width: 120px;
    padding: .35rem;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 8px 20px rgba(0,0,0,.12);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: .25rem;
  }

  .menu-panel .edit {
    width: 100%;
    text-align: left;
    background: #fff;
    border: 1px solid #d0d0d0;
    color: #333;
    border-radius: 6px;
    padding: .45rem .55rem;
    cursor: pointer;
    font-size: .85rem;
  }
  .menu-panel .edit:hover { background: #f5f5f5; }

  .menu-panel .delete {
    width: 100%;
    text-align: left;
    background: #fff;
    border: 1px solid #f1d1d1;
    color: #b10000;
    border-radius: 6px;
    padding: .45rem .55rem;
    cursor: pointer;
    font-size: .85rem;
  }
  .menu-panel .delete:hover { background: #fff1f1; }
</style>
