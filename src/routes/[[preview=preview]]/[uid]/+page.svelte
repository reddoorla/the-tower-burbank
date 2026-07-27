<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { page } from "$app/state";
  import { components } from "$lib/slices";
  import { loadPresentation } from "$lib/blux/presentation";
  import FrozenPage from "$lib/blux-frozen/FrozenPage.svelte";

  let { data } = $props();
</script>

{#if data.frozen}
  <!-- Frozen Blux page: the export's own settled markup through <FrozenPage>
       (the root layout renders bare for a frozen page). Keyed by uid: FrozenPage
       wires its hydration (sticky nav, menu close, reveal, map) in onMount, so a
       uid→uid client navigation must REMOUNT it — SvelteKit otherwise reuses the
       component instance and every mount-time DOM reference would go stale. -->
  {#key page.params["uid"]}
    <FrozenPage
      template={data.template}
      styleCss={data.styleCss}
      fontLinks={data.fontLinks}
      slots={data.slots}
    />
  {/key}
{:else}
  <!-- Per-band Blux presentation (block styles, backgrounds, grid trees) from
       the faithful-grid manifest, selected by page uid (a multi-page manifest
       namespaces bands per page; the flat single-page form ignores the uid).
       Empty until the site is converted with `blux convert`; SliceZone hands
       it to every slice as `context`. -->
  <SliceZone
    slices={data.page.data.slices}
    {components}
    context={{
      presentation: loadPresentation(page.params["uid"]),
      collections: data.collections,
    }}
  />
{/if}
