<script lang="ts">
  import Header from './Header.svelte';
  import Toast from './Toast.svelte';

  interface UserSummary {
    username: string;
    fullName: string;
    role: string;
    allowedGroups: string[];
  }

  interface Tag { id: number; name: string; }
  interface Subject { id: number; name: string; }

  let { session, users = [] }: {
    session: { fullName: string; username: string; };
    users?: UserSummary[];
  } = $props();

  let toastMsg = $state('');
  let toastType: 'success' | 'error' = 'success';
  let toastVisible = $state(false);

  let addUsername = $state('');
  let addFullName = $state('');
  let addPassword = $state('');
  let addAllowedGroups = $state('');
  let formError = $state('');

  let editingUser = $state<string | null>(null);
  let editGroups = $state('');

  let tagsList = $state<Tag[]>([]);
  let subjectsList = $state<Subject[]>([]);
  let newTagName = $state('');
  let newSubjectName = $state('');
  let tagsError = $state('');
  let subjectsError = $state('');

  $effect(() => {
    if (typeof window === 'undefined') return;
    fetch('/api/tags').then(r => r.ok ? r.json() : []).then((d: Tag[]) => { tagsList = d; }).catch(() => {});
    fetch('/api/subjects').then(r => r.ok ? r.json() : []).then((d: Subject[]) => { subjectsList = d; }).catch(() => {});
  });

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toastMsg = msg;
    toastType = type;
    toastVisible = true;
    setTimeout(() => { toastVisible = false; }, 3000);
  }

  async function handleAddUser() {
    formError = '';
    const groups = addAllowedGroups
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);

    const body = {
      username: addUsername,
      fullName: addFullName,
      password: addPassword,
      allowedGroups: groups.length > 0 ? groups : ['default'],
    };

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      try {
        const json = await res.json();
        formError = json?.error ? String(json.error) : 'Unable to create user.';
      } catch {
        formError = 'Unable to create user.';
      }
      return;
    }

    showToast('User created');
    addUsername = '';
    addFullName = '';
    addPassword = '';
    addAllowedGroups = '';
    setTimeout(() => location.reload(), 500);
  }

  async function handleDelete(user: string) {
    if (!window.confirm(`Remove @${user}?`)) return;

    const res = await fetch(`/api/admin/users/${encodeURIComponent(user)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      try {
        const json = await res.json();
        formError = json?.error ? String(json.error) : 'Unable to remove user.';
      } catch {
        formError = 'Unable to remove user.';
      }
      return;
    }

    showToast('User removed');
    setTimeout(() => location.reload(), 500);
  }

  function startEdit(user: UserSummary) {
    editingUser = user.username;
    editGroups = user.allowedGroups.join(', ');
  }

  function cancelEdit() {
    editingUser = null;
    editGroups = '';
  }

  async function saveGroups(user: string) {
    formError = '';
    const groups = editGroups
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);

    if (groups.length === 0) {
      formError = 'At least one group is required.';
      return;
    }

    const res = await fetch(`/api/admin/users/${encodeURIComponent(user)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allowedGroups: groups }),
    });

    if (!res.ok) {
      try {
        const json = await res.json();
        formError = json?.error ? String(json.error) : 'Unable to update groups.';
      } catch {
        formError = 'Unable to update groups.';
      }
      return;
    }

    showToast('Groups updated');
    setTimeout(() => location.reload(), 500);
  }

  async function handleAddTag() {
    tagsError = '';
    const name = newTagName.trim();
    if (!name) { tagsError = 'Tag name is required.'; return; }
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      try { const j = await res.json(); tagsError = j?.error ? String(j.error) : 'Unable to create tag.'; } catch { tagsError = 'Unable to create tag.'; }
      return;
    }
    const { id } = await res.json();
    tagsList = [...tagsList, { id, name }];
    newTagName = '';
    showToast('Tag created');
  }

  async function handleAddSubject() {
    subjectsError = '';
    const name = newSubjectName.trim();
    if (!name) { subjectsError = 'Subject name is required.'; return; }
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      try { const j = await res.json(); subjectsError = j?.error ? String(j.error) : 'Unable to create subject.'; } catch { subjectsError = 'Unable to create subject.'; }
      return;
    }
    const { id } = await res.json();
    subjectsList = [...subjectsList, { id, name }];
    newSubjectName = '';
    showToast('Subject created');
  }
</script>

<Header {session} isAdmin={true} title="Admin Dashboard" navLinks={[
  { href: '/app', label: 'Back to app' },
  { href: '/timeline', label: 'Timeline' },
]} />

<div class="wrap">
  <div class="card">
    <h2 style="font-size:1.1rem;margin-bottom:.75rem;">Add user</h2>
    <form onsubmit={(e) => { e.preventDefault(); handleAddUser(); }}>
      <div class="form-grid">
        <div class="field">
          <label for="add-username">Username</label>
          <input id="add-username" name="username" required bind:value={addUsername} />
        </div>
        <div class="field">
          <label for="add-fullName">Full name</label>
          <input id="add-fullName" name="fullName" required bind:value={addFullName} />
        </div>
        <div class="field">
          <label for="add-password">Password</label>
          <input id="add-password" name="password" type="password" required minlength="8" maxlength="128" bind:value={addPassword} />
        </div>
        <div class="field">
          <label for="add-allowedGroups">Allowed group</label>
          <input id="add-allowedGroups" list="group-list" name="allowedGroups" bind:value={addAllowedGroups} />
          <datalist id="group-list">
            <option value="Adams Family" />
            <option value="Meiling Family" />
          </datalist>
        </div>
      </div>
      <button class="save-btn" type="submit">Create user</button>
      <p class="error">{formError}</p>
    </form>
  </div>

  <div class="card">
    <h2 style="font-size:1.1rem;margin-bottom:.25rem;">Contributors</h2>
    <p class="muted" style="margin-bottom:.75rem;">Admin users cannot be removed.</p>
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Full Name</th>
          <th>Allowed Groups</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each users as user (user.username)}
          <tr data-username={user.username}>
            <td><strong>@{user.username}</strong></td>
            <td>{user.fullName}</td>
            <td>
              {#if editingUser === user.username}
                <div class="group-edit-row active">
                  <input type="text" bind:value={editGroups} class="group-edit-input" />
                  <button class="group-save-btn" type="button" onclick={() => saveGroups(user.username)}>Save</button>
                  <button class="group-cancel-btn" type="button" onclick={cancelEdit}>Cancel</button>
                </div>
              {:else}
                <div class="group-display-row" data-role={user.role}>
                  {#each user.allowedGroups as g}
                    <span class="group-chip">{g}</span>
                  {/each}
                </div>
              {/if}
            </td>
            <td>
              {#if user.role === 'admin'}
                <span class="muted">Owner</span>
              {:else}
                <button class="edit-btn" type="button" onclick={() => startEdit(user)}>Edit</button>
                <button class="delete-btn" type="button" onclick={() => handleDelete(user.username)}>Remove</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2 style="font-size:1.1rem;margin-bottom:.75rem;">Tags</h2>
    <form onsubmit={(e) => { e.preventDefault(); handleAddTag(); }} class="inline-form">
      <input placeholder="New tag name" maxlength="100" bind:value={newTagName} />
      <button class="save-btn" type="submit">Add tag</button>
    </form>
    <p class="error">{tagsError}</p>
    {#if tagsList.length > 0}
      <div class="chip-list">
        {#each tagsList as tag (tag.id)}
          <span class="group-chip">{tag.name}</span>
        {/each}
      </div>
    {:else}
      <p class="muted" style="margin-top:.5rem;">No tags yet.</p>
    {/if}
  </div>

  <div class="card">
    <h2 style="font-size:1.1rem;margin-bottom:.75rem;">Subjects</h2>
    <form onsubmit={(e) => { e.preventDefault(); handleAddSubject(); }} class="inline-form">
      <input placeholder="New subject name" maxlength="100" bind:value={newSubjectName} />
      <button class="save-btn" type="submit">Add subject</button>
    </form>
    <p class="error">{subjectsError}</p>
    {#if subjectsList.length > 0}
      <div class="chip-list">
        {#each subjectsList as subject (subject.id)}
          <span class="group-chip">{subject.name}</span>
        {/each}
      </div>
    {:else}
      <p class="muted" style="margin-top:.5rem;">No subjects yet.</p>
    {/if}
  </div>
</div>

<Toast visible={toastVisible} type={toastType} message={toastMsg} />

<style>
  .wrap { max-width: 900px; margin: 0 auto; padding: 1rem; }

  .card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: .75rem;
    margin-bottom: .75rem;
  }
  .field { display: flex; flex-direction: column; gap: .35rem; }
  .field label { font-size: .8rem; font-weight: 600; color: #555; }
  .field input {
    padding: .55rem .65rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font: inherit;
  }
  .save-btn {
    padding: .55rem .9rem;
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
  }
  .save-btn:hover { background: #333; }
  .inline-form {
    display: flex;
    gap: .5rem;
    margin-bottom: .5rem;
  }
  .inline-form input {
    flex: 1;
    padding: .5rem .65rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font: inherit;
  }
  .chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: .35rem;
    margin-top: .5rem;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .65rem; border-bottom: 1px solid #eee; font-size: .9rem; }
  th { background: #f0f0f0; }
  .delete-btn {
    border: 1px solid #f1d1d1;
    background: #fff;
    color: #b10000;
    border-radius: 6px;
    padding: .35rem .55rem;
    cursor: pointer;
  }
  .delete-btn:hover { background: #fff1f1; }
  .edit-btn {
    border: 1px solid #d0d0d0;
    background: #fff;
    color: #333;
    border-radius: 6px;
    padding: .35rem .55rem;
    cursor: pointer;
    margin-right: .25rem;
  }
  .edit-btn:hover { background: #f0f0f0; }
  .muted { color: #777; font-size: .9rem; }
  .error {
    color: #a10000;
    font-size: .9rem;
    margin-top: .5rem;
    min-height: 1.2rem;
  }
  .group-chip {
    display: inline-block;
    border: 1px solid #e0e0e0;
    border-radius: 999px;
    padding: .15rem .55rem;
    font-size: .8rem;
    margin: .1rem .15rem .1rem 0;
    background: #f8f8f8;
    color: #444;
  }
  .group-edit-row { display: none; align-items: center; gap: .35rem; }
  .group-edit-row.active { display: flex; }
  .group-edit-input {
    padding: .35rem .5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font: inherit;
    font-size: .85rem;
    width: 180px;
  }
  .group-save-btn {
    padding: .35rem .6rem;
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    font-size: .8rem;
  }
  .group-cancel-btn {
    padding: .35rem .6rem;
    background: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    font-size: .8rem;
  }
</style>
