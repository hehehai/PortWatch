import SwiftUI

struct MenuBarPanelView: View {
    @ObservedObject var store: PortWatchStore
    @ObservedObject var settingsStore: PortWatchSettingsStore
    @ObservedObject var updater: AppUpdater
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PortWatch")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                    Text("\(store.visiblePortCount) ports")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(settingsStore.preferences.selectedRefreshProfile.title)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.black.opacity(0.08)))
            }

            HStack(spacing: 8) {
                Button("Open App") {
                    openWindow(id: "main")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)

                Button("Refresh") {
                    Task { await store.refresh(reason: .manual) }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button("Updates") {
                    updater.checkForUpdates()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(!updater.canCheckForUpdates)
            }

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(store.filteredRecords.prefix(8))) { record in
                        HStack(spacing: 8) {
                            Text("\(record.port)")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .frame(width: 44, height: 24)
                                .background(RoundedRectangle(cornerRadius: 8).fill(Color.green.opacity(0.18)))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.displayTitle)
                                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                                    .lineLimit(1)
                                Text("PID \(record.pid) • \(PortWatchFormatters.condensedPath(record.displaySubtitle))")
                                    .font(.system(size: 10, weight: .medium, design: .rounded))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }

                            Spacer(minLength: 4)

                            Button {
                                openWindow(id: "main")
                                store.requestTermination(for: record)
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(Color.red.opacity(0.8))
                            }
                            .buttonStyle(.plain)
                            .disabled(store.isKilling)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .frame(maxHeight: 280)
        }
        .padding(14)
        .frame(width: 340)
        .task {
            store.start()
        }
    }
}
