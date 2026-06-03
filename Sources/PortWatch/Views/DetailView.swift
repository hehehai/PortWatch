import SwiftUI

struct DetailView: View {
    let record: PortRecord?
    let isKilling: Bool
    let errorMessage: String?
    let statusMessage: String?
    let onRefresh: () -> Void
    let onKill: () -> Void

    var body: some View {
        Group {
            if let record {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        header(for: record)
                        messageCard
                        metadataGrid(for: record)
                        if !record.launchChain.isEmpty {
                            launchChainCard(for: record)
                        }
                    }
                    .padding(24)
                }
                .background {
                    LinearGradient(
                        colors: [
                            Color(nsColor: .windowBackgroundColor),
                            Color(nsColor: .underPageBackgroundColor),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            } else {
                ContentUnavailableView(
                    "Select a Port",
                    systemImage: "sidebar.left",
                    description: Text("Choose a listening port from the sidebar to inspect its process metadata.")
                )
            }
        }
    }

    private func header(for record: PortRecord) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Port \(record.port)")
                        .font(.system(size: 34, weight: .bold, design: .rounded))

                    Text(record.displayTitle)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 10) {
                    Text(record.protocolName)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(.thinMaterial, in: Capsule())

                    Button(role: .destructive, action: onKill) {
                        Label(isKilling ? "Terminating..." : "Terminate Process", systemImage: "xmark.circle.fill")
                    }
                    .disabled(isKilling)
                }
            }

            Text(record.endpoint)
                .font(.body.monospaced())
                .foregroundStyle(.secondary)
        }
    }

    private var messageCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let statusMessage {
                Label(statusMessage, systemImage: "info.circle")
                    .foregroundStyle(.secondary)
            }

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            }

            HStack(spacing: 12) {
                Button(action: onRefresh) {
                    Label("Refresh Snapshot", systemImage: "arrow.clockwise")
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func metadataGrid(for record: PortRecord) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Process Snapshot")
                .font(.headline)

            LazyVGrid(
                columns: [
                    GridItem(.adaptive(minimum: 220), spacing: 16, alignment: .topLeading),
                ],
                alignment: .leading,
                spacing: 16
            ) {
                InfoCard(title: "PID", value: String(record.pid))
                InfoCard(title: "User", value: record.user)
                InfoCard(title: "State", value: record.state)
                InfoCard(title: "Started", value: PortWatchFormatters.timestamp(record.startedAt))
                InfoCard(title: "Uptime", value: PortWatchFormatters.uptime(record.uptime))
                InfoCard(title: "Launched By", value: record.launchedBy ?? "Unavailable")
                InfoCard(title: "Source", value: record.source ?? "Unavailable")
                InfoCard(title: "Working Directory", value: record.workingDirectory ?? "Unavailable")
                InfoCard(title: "Executable", value: record.executablePath ?? "Unavailable")
                InfoCard(title: "Descriptor", value: record.fd)
            }
        }
    }

    private func launchChainCard(for record: PortRecord) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Launch Chain")
                .font(.headline)

            Text(record.launchChain.joined(separator: "  >  "))
                .font(.body.monospaced())
                .textSelection(.enabled)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct InfoCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(value)
                .font(.body)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 88, alignment: .topLeading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
