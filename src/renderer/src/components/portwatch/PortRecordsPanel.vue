<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area'
import { canStarPort, isStarredPort } from '@/lib/ports'
import PortRecordItem from './PortRecordItem.vue'
import type { PortRecord, StarredPort } from '@/types'

defineProps<{
  records: PortRecord[]
  highlightedRecordIds: string[]
  selectedId?: string
  isKilling: boolean
  starredPorts: StarredPort[]
}>()

const emit = defineEmits<{
  activate: [id: string]
  terminate: [record: PortRecord]
  toggleStar: [record: PortRecord]
}>()
</script>

<template>
  <ScrollArea class="h-full pr-2">
    <PortRecordItem
      v-for="record in records"
      :key="record.id"
      :record="record"
      :is-killing="isKilling"
      :is-newly-detected="highlightedRecordIds.includes(record.id)"
      :is-selected="record.id === selectedId"
      :is-starred="isStarredPort(record, starredPorts)"
      :can-toggle-star="canStarPort(record)"
      @activate="emit('activate', $event)"
      @terminate="emit('terminate', $event)"
      @toggle-star="emit('toggleStar', $event)"
    />
  </ScrollArea>
</template>
