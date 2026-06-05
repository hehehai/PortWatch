<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/portwatch/AppHeader.vue'
import PortRecordsPanel from '@/components/portwatch/PortRecordsPanel.vue'
import SettingsPanel from '@/components/portwatch/SettingsPanel.vue'
import { usePortWatch } from './composables/usePortWatch'

type PanelMode = 'ports' | 'settings'

const panelMode = ref<PanelMode>('ports')

const {
  records,
  highlightedRecordIds,
  preferences,
  selectedId,
  selectRecord,
  selectedProfile,
  isKilling,
  isCheckingUpdate,
  isMac,
  showCustomWindowControls,
  hasUpdateBadge,
  updateBadgeLabel,
  updateBadgeTitle,
  isFullScreen,
  errorMessage,
  updateMessage,
  terminate,
  checkUpdates,
  installUpdate,
  minimizeWindow,
  closeWindow,
  toggleFullScreen,
  toggleRefreshProfile,
  updateInterval,
  addPortRange,
  removePortRange,
  updatePortRange,
  toggleStarredPort,
} = usePortWatch()
</script>

<template>
  <main :class="['relative flex h-full flex-col overflow-hidden gap-3 bg-background p-3']">
    <div
      v-if="!isMac"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
    >
      <div class="absolute -top-10 right-[-20px] size-40 rounded-full bg-emerald-200/40 blur-3xl" />
      <div
        class="absolute bottom-[-40px] left-[-16px] size-48 rounded-full bg-amber-100/65 blur-3xl"
      />
    </div>

    <AppHeader
      :is-mac="isMac"
      :show-custom-window-controls="showCustomWindowControls"
      :is-full-screen="isFullScreen"
      :panel-mode="panelMode"
      :records-count="records.length"
      :selected-profile="selectedProfile"
      :has-update-badge="hasUpdateBadge"
      :update-badge-label="updateBadgeLabel"
      :update-badge-title="updateBadgeTitle"
      @close-window="closeWindow"
      @install-update="installUpdate"
      @minimize-window="minimizeWindow"
      @open-ports="panelMode = 'ports'"
      @open-settings="panelMode = 'settings'"
      @toggle-full-screen="toggleFullScreen"
      @toggle-refresh-profile="toggleRefreshProfile"
    />

    <section
      :class="[
        'window-no-drag relative min-h-0 flex-1 overflow-hidden rounded-xl pl-2 py-2 bg-white',
      ]"
    >
      <div
        v-if="errorMessage"
        class="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
      >
        {{ errorMessage }}
      </div>
      <div
        v-if="updateMessage"
        class="mb-2 rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        {{ updateMessage }}
      </div>

      <PortRecordsPanel
        v-if="panelMode === 'ports'"
        :records="records"
        :highlighted-record-ids="highlightedRecordIds"
        :selected-id="selectedId"
        :is-killing="isKilling"
        :starred-ports="preferences.starredPorts"
        @activate="selectRecord"
        @terminate="terminate"
        @toggle-star="toggleStarredPort"
      />

      <SettingsPanel
        v-else
        :preferences="preferences"
        :is-checking-update="isCheckingUpdate"
        :update-message="updateMessage"
        @add-port-range="addPortRange"
        @check-updates="checkUpdates"
        @remove-port-range="removePortRange"
        @update-interval="updateInterval"
        @update-port-range="updatePortRange"
      />
    </section>
  </main>
</template>
