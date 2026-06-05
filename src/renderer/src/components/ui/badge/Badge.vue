<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { BadgeVariants } from './badgeVariants'
import { cn } from '@/lib/utils'
import { badgeVariants } from './badgeVariants'

const props = defineProps<{
  variant?: BadgeVariants['variant']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn(badgeVariants({ variant }), props.class)">
    <slot />
  </div>
</template>
