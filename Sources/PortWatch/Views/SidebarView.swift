import SwiftUI

struct SidebarView: View {
    let records: [PortRecord]
    @Binding var selection: PortRecord.ID?
    let isLoading: Bool
    let isKilling: Bool
    let onKill: (PortRecord) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                if isLoading && records.isEmpty {
                    loadingState
                } else if records.isEmpty {
                    emptyState
                } else {
                    ForEach(records) { record in
                        PortItemCard(
                            record: record,
                            isSelected: selection == record.id,
                            isKilling: isKilling,
                            onSelect: {
                                selection = record.id
                            },
                            onKill: {
                                onKill(record)
                            }
                        )
                    }
                }
            }
            .padding(8)
        }
        .scrollIndicators(.hidden)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white)
        )
    }

    private var loadingState: some View {
        VStack(spacing: 8) {
            ProgressView()
                .tint(Color(red: 0.14, green: 0.58, blue: 0.44))

            Text("Loading ports")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.black.opacity(0.32))

            Text("No listening ports")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.58))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

private struct PortItemCard: View {
    let record: PortRecord
    let isSelected: Bool
    let isKilling: Bool
    let onSelect: () -> Void
    let onKill: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                portBadge

                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(record.displayTitle)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.black.opacity(0.88))
                            .lineLimit(1)

                        Spacer(minLength: 4)

                        Text(PortWatchFormatters.uptime(record.uptime))
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color.black.opacity(0.38))
                    }

                    Text(primarySubtitle)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.black.opacity(0.46))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(rowBackground)
            .contentShape(Rectangle())
            .onTapGesture(perform: onSelect)

            if isSelected {
                detailCard
            }
        }
    }

    private var portBadge: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? Color(red: 0.14, green: 0.58, blue: 0.44) : Color(red: 0.95, green: 0.95, blue: 0.94))
                .frame(width: 42, height: 34)

            Text(String(record.port))
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(isSelected ? Color.white : Color.black.opacity(0.72))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    private var rowBackground: some View {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: isSelected ? 6 : 16,
            bottomTrailingRadius: isSelected ? 6 : 16,
            topTrailingRadius: 16,
            style: .continuous
        )
        .fill(isSelected ? Color(red: 0.96, green: 0.95, blue: 0.92) : Color(red: 0.985, green: 0.984, blue: 0.978))
    }

    private var detailCard: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                detailLine(label: "Address", value: record.endpoint)
                detailLine(label: "Source", value: secondaryDetail)

                if let launchedBy = record.launchedBy {
                    detailLine(label: "Launch", value: launchedBy)
                }
            }

            Spacer(minLength: 8)

            Button(action: onKill) {
                Image(systemName: isKilling ? "hourglass" : "xmark.circle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color(red: 0.72, green: 0.25, blue: 0.23))
                    .frame(width: 28, height: 28)
                    .background(
                        Circle()
                            .fill(Color.white.opacity(0.8))
                    )
            }
            .buttonStyle(.plain)
            .disabled(isKilling)
        }
        .padding(.horizontal, 12)
        .padding(.top, 7)
        .padding(.bottom, 10)
        .background(
            UnevenRoundedRectangle(
                topLeadingRadius: 0,
                bottomLeadingRadius: 16,
                bottomTrailingRadius: 16,
                topTrailingRadius: 0,
                style: .continuous
            )
            .fill(Color(red: 0.96, green: 0.95, blue: 0.92))
        )
        .padding(.top, -2)
    }

    private var primarySubtitle: String {
        "PID \(record.pid) • \(secondaryDetail)"
    }

    private var secondaryDetail: String {
        PortWatchFormatters.condensedPath(record.source ?? record.workingDirectory ?? "Unavailable")
    }

    private func detailLine(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.34))

            Text(value)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.68))
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }
}
