<script setup lang="ts">
import { Star, XCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { formatPortUptime, portSource } from '@/lib/ports'
import type { PortRecord } from '@/types'

defineProps<{
  record: PortRecord
  isKilling: boolean
  isNewlyDetected: boolean
  isSelected: boolean
  isStarred: boolean
  canToggleStar: boolean
}>()

const emit = defineEmits<{
  activate: [id: string]
  terminate: [record: PortRecord]
  toggleStar: [record: PortRecord]
}>()
</script>

<template>
  <div
    class="relative mb-2 block w-full overflow-hidden rounded-xl text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
  >
    <div
      role="button"
      tabindex="0"
      class="relative z-10 flex items-start gap-3 rounded-xl px-3 py-2 cursor-pointer"
      :class="isSelected ? ' bg-[#f4f2eb] shadow-sm' : 'bg-[#fbfaf7]'"
      @click="emit('activate', record.id)"
      @keydown.enter="emit('activate', record.id)"
      @keydown.space.prevent="emit('activate', record.id)"
    >
      <div
        class="flex w-[52px] shrink-0 items-center justify-center rounded-xl py-2 font-mono text-sm font-bold leading-none transition-colors"
        :class="
          isNewlyDetected
            ? 'portwatch-port-badge-flash text-white'
            : isSelected
              ? 'bg-[#24996f] text-white'
              : 'bg-muted text-foreground/75'
        "
      >
        {{ record.port }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <div class="truncate text-base font-bold leading-5 inline-flex items-center gap-2">
            <span>{{ record.command }}</span>
            <Star
              v-if="isStarred"
              class="size-3.5 shrink-0 fill-amber-400 text-amber-500"
              aria-label="Starred port"
            />
          </div>
          <div class="ml-auto shrink-0 font-mono text-xs font-medium text-muted-foreground">
            {{ formatPortUptime(record.uptime) }}
          </div>
        </div>
        <div class="mt-1 truncate text-sm font-medium text-muted-foreground">
          {{ portSource(record) }}
        </div>
      </div>
    </div>

    <div v-if="isSelected" class="px-2 relative">
      <div class="flex items-start gap-3 rounded-b-xl bg-[#f4f2eb] px-3 pb-1.5 pt-2">
        <div class="grid min-w-0 flex-1 grid-cols-[86px_1fr] gap-x-4 gap-y-2">
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Launch
            </div>
            <div class="flex items-center gap-1 truncate text-sm font-semibold text-foreground/70">
              <span class="truncate">{{ record.launchedBy ?? 'Unknown' }}</span>
            </div>
          </div>
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              PID
            </div>
            <div class="truncate text-sm font-semibold text-foreground/70">
              {{ record.pid }}
            </div>
          </div>
          <div class="col-span-2">
            <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Source
            </div>
            <div class="line-clamp-2 text-sm font-semibold text-foreground/70">
              {{ portSource(record) }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start">
          <Button
            variant="ghost"
            size="icon-sm"
            class="rounded-xl bg-white/80 text-amber-500 hover:bg-white"
            :disabled="!canToggleStar"
            :title="
              canToggleStar
                ? isStarred
                  ? 'Unmark port'
                  : 'Mark port'
                : 'No path available to mark'
            "
            @click.stop="emit('toggleStar', record)"
          >
            <Star
              class="size-5"
              :class="isStarred ? 'fill-amber-400 text-amber-500' : 'text-amber-500'"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            class="rounded-xl bg-white/80 text-destructive hover:bg-white"
            :disabled="isKilling"
            title="Terminate process"
            @click.stop="emit('terminate', record)"
          >
            <XCircle class="size-5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portwatch-port-badge-flash {
  animation: portwatch-port-badge-pulse 1.1s ease-in-out infinite;
}

@keyframes portwatch-port-badge-pulse {
  0%,
  100% {
    background: rgb(36 153 111 / 0.82);
    box-shadow: 0 0 0 0 rgb(52 211 153 / 0.12);
  }

  50% {
    background: rgb(16 185 129);
    box-shadow:
      0 0 0 4px rgb(52 211 153 / 0.2),
      0 0 24px rgb(16 185 129 / 0.28);
  }
}
</style>
