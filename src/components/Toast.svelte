<script lang="ts">
  let { visible = false, type = 'success', message = '' }: {
    visible?: boolean;
    type?: 'success' | 'error';
    message?: string;
  } = $props();
</script>

{#if visible}
  <div class="toast {type} show">{message}</div>
{/if}

<style>
  .toast {
    position: fixed; bottom: 1rem; right: 1rem;
    padding: .75rem 1.25rem; border-radius: 6px; color: #fff;
    opacity: 0; transition: opacity .3s; z-index: 300;
  }
  .toast.show { opacity: 1; }
  .toast.error { background: #c00; }
  .toast.success { background: #2a7; }
</style>
