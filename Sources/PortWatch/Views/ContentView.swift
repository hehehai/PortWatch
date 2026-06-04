import SwiftUI

private enum MainLayout {
    static let horizontalInset: CGFloat = 10
    static let headerTopInset: CGFloat = 4
    static let bottomInset: CGFloat = 10
    static let windowCornerRadius: CGFloat = 18
}

struct ContentView: View {
    @ObservedObject var store: PortWatchStore
    @ObservedObject var settingsStore: PortWatchSettingsStore
    @ObservedObject var updater: AppUpdater
    @State private var panelMode: MainPanelMode = .ports

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(red: 0.95, green: 0.95, blue: 0.94)
                .ignoresSafeArea()

            VStack(spacing: 6) {
                MainHeaderView(
                    mode: panelMode,
                    visiblePortCount: store.visiblePortCount,
                    selectedRefreshProfile: store.selectedRefreshProfile,
                    onSelectRefreshProfile: store.selectRefreshProfile(_:),
                    onOpenSettings: { panelMode = .settings },
                    onCloseSettings: { panelMode = .ports }
                )

                if panelMode == .ports {
                    SidebarView(
                        records: store.filteredRecords,
                        selection: $store.selection,
                        isLoading: store.isLoading,
                        isKilling: store.isKilling,
                        onKill: { record in
                            store.requestTermination(for: record)
                        }
                    )
                } else {
                    SettingsView(settingsStore: settingsStore, updater: updater)
                }
            }
            .padding(.horizontal, MainLayout.horizontalInset)
            .padding(.top, MainLayout.headerTopInset)
            .padding(.bottom, MainLayout.bottomInset)

            WindowTrafficLightsView()
        }
        .ignoresSafeArea(.container, edges: .top)
        .clipShape(RoundedRectangle(cornerRadius: MainLayout.windowCornerRadius, style: .continuous))
        .alert(
            "Terminate Process?",
            isPresented: terminationAlertPresented,
            presenting: store.pendingTerminationRecord
        ) { _ in
            Button("Cancel", role: .cancel) {
                store.dismissTerminationRequest()
            }

            Button("Terminate", role: .destructive) {
                Task {
                    await store.confirmTermination()
                }
            }
        } message: { record in
            Text(terminationMessage(for: record))
        }
    }

    private var terminationAlertPresented: Binding<Bool> {
        Binding(
            get: { store.pendingTerminationRecord != nil },
            set: { isPresented in
                if !isPresented {
                    store.dismissTerminationRequest()
                }
            }
        )
    }

    private func terminationMessage(for record: PortRecord) -> String {
        var lines = [
            "\(record.displayTitle) (PID \(record.pid)) is listening on port \(record.port).",
            "A SIGTERM will be sent first, followed by SIGKILL if the process does not exit.",
        ]

        if let source = record.source ?? record.workingDirectory {
            lines.append("Source: \(PortWatchFormatters.condensedPath(source))")
        }

        if !record.launchChain.isEmpty {
            lines.append("Launch chain: \(record.launchChain.joined(separator: " > "))")
        }

        return lines.joined(separator: "\n")
    }
}
