<script setup lang="ts">
import { computed } from 'vue'
import type { PartialOptions } from 'overlayscrollbars'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue'

const props = withDefaults(
  defineProps<{
    element?: string
    options?: PartialOptions
  }>(),
  {
    element: 'div',
  },
)

const scrollAreaOptions = computed<PartialOptions>(() => ({
  ...props.options,
  overflow: {
    x: 'hidden',
    y: 'scroll',
    ...props.options?.overflow,
  },
  scrollbars: {
    theme: 'portwatch-scrollbars',
    autoHide: 'leave',
    autoHideDelay: 120,
    autoHideSuspend: false,
    dragScroll: true,
    clickScroll: false,
    ...props.options?.scrollbars,
  },
}))
</script>

<template>
  <OverlayScrollbarsComponent
    :element="element"
    :options="scrollAreaOptions"
    class="portwatch-scroll-area"
    defer
  >
    <slot />
  </OverlayScrollbarsComponent>
</template>
