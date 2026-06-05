<script setup lang="ts">
import { Bolt, MinusCircle, PlusCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { describePortRange, type IntervalUpdate, type PortRangeUpdate } from '@/lib/preferences'
import type { PortWatchPreferences } from '@/types'

defineProps<{
  preferences: PortWatchPreferences
  isCheckingUpdate: boolean
  updateMessage?: string
}>()

const emit = defineEmits<{
  addPortRange: []
  checkUpdates: []
  removePortRange: [id: string]
  updateInterval: [payload: IntervalUpdate]
  updatePortRange: [payload: PortRangeUpdate]
}>()

function readNumericInput(event: Event): number | undefined {
  const value = Number((event.target as HTMLInputElement).value)
  return Number.isFinite(value) ? value : undefined
}
</script>

<template>
  <ScrollArea class="h-full pr-2">
    <div class="space-y-2">
      <section class="rounded-lg bg-[#fbfaf7] p-3">
        <div class="mb-3 text-sm font-bold">Refresh Rates</div>
        <label class="mb-2 flex items-center gap-3 text-sm font-semibold text-foreground/75">
          <span class="flex-1">Live interval</span>
          <input
            class="h-8 w-20 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
            type="number"
            min="0.5"
            step="0.5"
            :value="preferences.liveRefreshInterval"
            @change="
              emit('updateInterval', {
                key: 'liveRefreshInterval',
                value: readNumericInput($event),
              })
            "
          />
          <span class="text-xs text-muted-foreground">sec</span>
        </label>
        <label class="flex items-center gap-3 text-sm font-semibold text-foreground/75">
          <span class="flex-1">Normal interval</span>
          <input
            class="h-8 w-20 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
            type="number"
            min="1"
            step="1"
            :value="preferences.normalRefreshInterval"
            @change="
              emit('updateInterval', {
                key: 'normalRefreshInterval',
                value: readNumericInput($event),
              })
            "
          />
          <span class="text-xs text-muted-foreground">sec</span>
        </label>
      </section>

      <section class="rounded-lg bg-[#fbfaf7] p-3">
        <div class="mb-3 flex items-center gap-2">
          <div class="text-sm font-bold">Port Ranges</div>
          <Button
            class="ml-auto"
            variant="ghost"
            size="icon-sm"
            title="Add port range"
            @click="emit('addPortRange')"
          >
            <PlusCircle class="size-4" />
          </Button>
        </div>

        <div
          v-for="range in preferences.monitoredPortRanges"
          :key="range.id"
          class="mb-2 flex items-center gap-2 last:mb-0"
        >
          <input
            class="h-8 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
            type="number"
            min="0"
            max="65535"
            :title="describePortRange(range)"
            :value="range.lowerBound"
            @change="
              emit('updatePortRange', {
                id: range.id,
                key: 'lowerBound',
                value: readNumericInput($event),
              })
            "
          />
          <span class="text-xs font-bold text-muted-foreground">to</span>
          <input
            class="h-8 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-right font-mono text-sm"
            type="number"
            min="0"
            max="65535"
            :title="describePortRange(range)"
            :value="range.upperBound"
            @change="
              emit('updatePortRange', {
                id: range.id,
                key: 'upperBound',
                value: readNumericInput($event),
              })
            "
          />
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-destructive"
            title="Remove port range"
            @click="emit('removePortRange', range.id)"
          >
            <MinusCircle class="size-4" />
          </Button>
        </div>
      </section>

      <section class="rounded-lg bg-[#fbfaf7] p-3">
        <div class="mb-2 text-sm font-bold">Updates</div>
        <p class="mb-3 text-xs font-medium leading-5 text-muted-foreground">
          {{
            updateMessage ||
            'PortWatch checks for updates automatically when PORTWATCH_UPDATE_URL is configured.'
          }}
        </p>
        <Button
          variant="outline"
          size="sm"
          :disabled="isCheckingUpdate"
          @click="emit('checkUpdates')"
        >
          <Bolt class="size-4" :class="isCheckingUpdate && 'animate-pulse'" />
          Check updates
        </Button>
      </section>
    </div>
  </ScrollArea>
</template>
