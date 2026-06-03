import SwiftUI

struct SettingsView: View {
    @ObservedObject var settingsStore: PortWatchSettingsStore
    @ObservedObject var updater: AppUpdater

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                refreshCard
                portRangeCard
                updaterCard
            }
            .padding(8)
        }
        .scrollIndicators(.hidden)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white)
        )
    }

    private var refreshCard: some View {
        SettingsCard(title: "Refresh Rates") {
            VStack(alignment: .leading, spacing: 10) {
                intervalRow(
                    title: "Live interval",
                    value: settingsStore.preferences.liveRefreshInterval,
                    onChange: settingsStore.updateLiveRefreshInterval
                )
                intervalRow(
                    title: "Normal interval",
                    value: settingsStore.preferences.normalRefreshInterval,
                    onChange: settingsStore.updateNormalRefreshInterval
                )
            }
        }
    }

    private var portRangeCard: some View {
        SettingsCard(title: "Port Ranges") {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(settingsStore.preferences.monitoredPortRanges) { range in
                    HStack(spacing: 8) {
                        portField(
                            value: range.lowerBound,
                            placeholder: "0"
                        ) { settingsStore.updatePortRange(id: range.id, lowerBound: $0) }

                        Text("to")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.black.opacity(0.45))

                        portField(
                            value: range.upperBound,
                            placeholder: "65535"
                        ) { settingsStore.updatePortRange(id: range.id, upperBound: $0) }

                        Button(role: .destructive) {
                            settingsStore.removePortRange(id: range.id)
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .foregroundStyle(Color.red.opacity(0.8))
                        }
                        .buttonStyle(.plain)
                    }
                }

                Button {
                    settingsStore.addPortRange()
                } label: {
                    Label("Add port range", systemImage: "plus.circle")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var updaterCard: some View {
        SettingsCard(title: "Updates") {
            VStack(alignment: .leading, spacing: 10) {
                Text(updater.statusMessage)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.black.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)

                Button {
                    updater.checkForUpdates()
                } label: {
                    Label("Check for updates", systemImage: "arrow.down.circle")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(!updater.canCheckForUpdates)
            }
        }
    }

    private func intervalRow(
        title: String,
        value: Double,
        onChange: @escaping (Double) -> Void
    ) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.68))

            Spacer()

            TextField(
                "",
                value: Binding(
                    get: { value },
                    set: { newValue in
                        onChange(newValue)
                    }
                ),
                format: .number.precision(.fractionLength(0...1))
            )
            .multilineTextAlignment(.trailing)
            .textFieldStyle(.roundedBorder)
            .frame(width: 70)

            Text("sec")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.45))
        }
    }

    private func portField(
        value: Int,
        placeholder: String,
        onChange: @escaping (Int) -> Void
    ) -> some View {
        TextField(
            placeholder,
            value: Binding(
                get: { value },
                set: { newValue in
                    onChange(newValue)
                }
            ),
            format: .number
        )
        .multilineTextAlignment(.trailing)
        .textFieldStyle(.roundedBorder)
        .frame(width: 82)
    }
}

private struct SettingsCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.72))

            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(red: 0.985, green: 0.984, blue: 0.978))
        )
    }
}
