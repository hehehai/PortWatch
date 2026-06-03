import SwiftUI

enum MainPanelMode {
    case ports
    case settings
}

struct MainHeaderView: View {
    let mode: MainPanelMode
    let visiblePortCount: Int
    let selectedRefreshProfile: RefreshProfile
    let onSelectRefreshProfile: (RefreshProfile) -> Void
    let onOpenSettings: () -> Void
    let onCloseSettings: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Spacer()
                    .frame(width: 50)

                Text(mode == .ports ? "Ports" : "Settings")
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.black.opacity(0.86))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)

                if mode == .ports {
                    Text("\(visiblePortCount)")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.black.opacity(0.62))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(Color.white.opacity(0.82))
                        )
                }
            }
            .layoutPriority(1)

            Spacer(minLength: 0)

            if mode == .ports {
                refreshModeControl
                settingsButton
            } else {
                backButton
            }
        }
        .padding(.leading, 4)
        .padding(.trailing, 8)
        .padding(.top, 7)
        .padding(.bottom, 5)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white.opacity(0.9))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.black.opacity(0.04), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 4)
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
