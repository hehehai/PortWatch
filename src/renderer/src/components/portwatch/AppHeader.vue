<script setup lang="ts">
import { ArrowLeft, Settings } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RefreshProfile } from '@/types'
import {
  MAC_TRAFFIC_LIGHT_GUTTER_PX,
  PORTWATCH_HEADER_HEIGHT_PX,
} from '../../../../shared/desktopChrome'

defineProps<{
  isMac: boolean
  showCustomWindowControls: boolean
  isFullScreen: boolean
  panelMode: 'ports' | 'settings'
  recordsCount: number
  selectedProfile: RefreshProfile
  hasUpdateBadge: boolean
  updateBadgeLabel?: string
  updateBadgeTitle: string
}>()

const emit = defineEmits<{
  closeWindow: []
  installUpdate: []
  minimizeWindow: []
  openPorts: []
  openSettings: []
  toggleFullScreen: []
  toggleRefreshProfile: []
}>()

const macHeaderStyle = {
  height: `${PORTWATCH_HEADER_HEIGHT_PX}px`,
  paddingLeft: `${MAC_TRAFFIC_LIGHT_GUTTER_PX}px`,
}

const defaultHeaderStyle = {
  height: `${PORTWATCH_HEADER_HEIGHT_PX}px`,
}
</script>

<template>
  <header
    :class="['window-drag flex shrink-0 items-center gap-3 rounded-xl bg-white px-2']"
    :style="isMac ? macHeaderStyle : defaultHeaderStyle"
  >
    <div class="window-no-drag flex min-w-0 items-center gap-2">
      <button
        v-if="hasUpdateBadge"
        class="rounded-full"
        :title="updateBadgeTitle"
        type="button"
        @click="emit('installUpdate')"
      >
        <Badge class="rounded-full bg-amber-100 px-2 text-amber-900 hover:bg-amber-200">
          {{ updateBadgeLabel }}
        </Badge>
      </button>
      <Badge v-else class="rounded-full px-2">{{ recordsCount }}</Badge>
    </div>

    <div class="window-no-drag ml-auto flex items-center gap-2">
      <Button
        v-if="panelMode === 'ports'"
        size="xs"
        class="rounded-full px-3 text-xs"
        title="Toggle refresh mode"
        @click="emit('toggleRefreshProfile')"
      >
        <div class="relative size-2">
          <span
            :class="[
              'z-10 absolute inset-0 m-auto inline-flex size-2 rounded-full bg-background opacity-75 animate-pulse',
              selectedProfile === 'live' ? 'bg-green-400' : '',
            ]"
            aria-hidden="true"
          />
          <span
            :class="[
              'absolute inset-0 m-auto inline-flex size-2 rounded-full bg-background animate-ping',
              selectedProfile === 'live' ? 'bg-green-400' : '',
            ]"
            aria-hidden="true"
          />
        </div>
        {{ selectedProfile === 'live' ? 'Live' : 'Normal' }}
      </Button>

      <Button
        v-if="panelMode === 'settings'"
        class="rounded-full"
        size="icon-xs"
        title="Back"
        @click="emit('openPorts')"
      >
        <ArrowLeft class="size-4" />
      </Button>
      <Button
        v-if="panelMode === 'ports'"
        class="rounded-full"
        size="icon-xs"
        title="Settings"
        @click="emit('openSettings')"
      >
        <Settings class="size-4" />
      </Button>
      <Button
        v-if="showCustomWindowControls"
        class="rounded-full"
        size="icon-xs"
        :title="isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'"
        @click="emit('toggleFullScreen')"
      >
        <span class="text-xs font-semibold leading-none">
          {{ isFullScreen ? 'Exit' : 'Zoom' }}
        </span>
      </Button>
      <Button
        v-if="showCustomWindowControls"
        class="rounded-full"
        size="icon-xs"
        title="Minimize"
        @click="emit('minimizeWindow')"
      >
        <span class="text-xs font-semibold leading-none">_</span>
      </Button>
      <Button
        v-if="showCustomWindowControls"
        class="rounded-full"
        size="icon-xs"
        title="Close"
        @click="emit('closeWindow')"
      >
        <span class="text-xs font-semibold leading-none">X</span>
      </Button>
    </div>
  </header>
</template>
