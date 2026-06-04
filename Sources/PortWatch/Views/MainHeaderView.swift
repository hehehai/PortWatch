import SwiftUI

enum MainPanelMode {
    case ports
    case settings
}

struct MainHeaderView: View {
    private let trafficLightReserveWidth: CGFloat = 76

    let mode: MainPanelMode
    let visiblePortCount: Int
    let selectedRefreshProfile: RefreshProfile
    let onSelectRefreshProfile: (RefreshProfile) -> Void
    let onOpenSettings: () -> Void
    let onCloseSettings: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Color.clear
                    .frame(width: trafficLightReserveWidth, height: 1)

                if mode == .ports {
                    countBadge
                }
            }

            Spacer(minLength: 0)

            if mode == .ports {
                refreshModeControl
                settingsButton
            } else {
                backButton
            }
        }
        .frame(height: 34)
        .padding(.leading, 0)
        .padding(.trailing, 8)
        .padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.black.opacity(0.04), lineWidth: 1)
        )
    }

    private var refreshModeControl: some View {
        HStack(spacing: 4) {
            ForEach(RefreshProfile.allCases, id: \.rawValue) { profile in
                Button {
                    onSelectRefreshProfile(profile)
                } label: {
                    Text(profile.title)
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(selectedRefreshProfile == profile ? Color.white : Color.black.opacity(0.62))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(selectedRefreshProfile == profile ? Color.black.opacity(0.78) : Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(
            Capsule()
                .fill(Color.white.opacity(0.88))
        )
    }

    private var countBadge: some View {
        Text("\(visiblePortCount)")
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(Color.black.opacity(0.72))
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(Color.white.opacity(0.94))
            )
    }

    private var settingsButton: some View {
        Button(action: onOpenSettings) {
            Image(systemName: "gearshape")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.black.opacity(0.72))
                .frame(width: 30, height: 30)
                .background(
                    Circle()
                        .fill(Color.white.opacity(0.9))
                )
        }
        .buttonStyle(.plain)
    }

    private var backButton: some View {
        Button(action: onCloseSettings) {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left")
                Text("Back")
            }
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.black.opacity(0.72))
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(Color.white.opacity(0.9))
            )
        }
        .buttonStyle(.plain)
    }
}
