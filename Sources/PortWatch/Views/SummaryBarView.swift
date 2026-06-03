import SwiftUI

struct SummaryBarView: View {
    let totalPortCount: Int
    let totalProcessCount: Int
    let currentUserProcessCount: Int
    let visiblePortCount: Int
    let visibleProcessCount: Int
    let lastUpdatedAt: Date?

    var body: some View {
        HStack(spacing: 12) {
            SummaryCard(
                title: "Listening Ports",
                value: String(totalPortCount),
                detail: visiblePortCount == totalPortCount ? "All entries visible" : "\(visiblePortCount) visible in filter",
                accent: .blue
            )

            SummaryCard(
                title: "Processes",
                value: String(totalProcessCount),
                detail: visibleProcessCount == totalProcessCount ? "Distinct PIDs in view" : "\(visibleProcessCount) distinct PIDs visible",
                accent: .mint
            )

            SummaryCard(
                title: "Your Processes",
                value: String(currentUserProcessCount),
                detail: "Distinct PIDs owned by current user",
                accent: .green
            )

            SummaryCard(
                title: "Last Refresh",
                value: PortWatchFormatters.summaryTimestamp(lastUpdatedAt),
                detail: PortWatchFormatters.relativeUpdate(lastUpdatedAt),
                accent: .orange
            )
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(.bar)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }
}

private struct SummaryCard: View {
    let title: String
    let value: String
    let detail: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle()
                    .fill(accent.gradient)
                    .frame(width: 10, height: 10)

                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded))

            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
