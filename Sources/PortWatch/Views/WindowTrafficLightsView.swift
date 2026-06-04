import AppKit
import SwiftUI

private enum WindowTrafficLightLayout {
    static let topInset: CGFloat = 24
    static let leadingInset: CGFloat = 14
    static let buttonSize: CGFloat = 14
    static let spacing: CGFloat = 10
}

struct WindowTrafficLightsView: View {
    var body: some View {
        HStack(spacing: WindowTrafficLightLayout.spacing) {
            trafficLight(color: Color(red: 1.0, green: 0.37, blue: 0.33)) {
                activeWindow?.performClose(nil)
            }

            trafficLight(color: Color(red: 1.0, green: 0.74, blue: 0.04)) {
                activeWindow?.performMiniaturize(nil)
            }

            trafficLight(color: Color(red: 0.80, green: 0.80, blue: 0.80)) {
                activeWindow?.performZoom(nil)
            }
        }
        .padding(.top, WindowTrafficLightLayout.topInset)
        .padding(.leading, WindowTrafficLightLayout.leadingInset)
    }

    private var activeWindow: NSWindow? {
        NSApp.keyWindow ?? NSApp.mainWindow ?? NSApp.windows.first
    }

    private func trafficLight(color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Circle()
                .fill(color)
                .frame(width: WindowTrafficLightLayout.buttonSize, height: WindowTrafficLightLayout.buttonSize)
        }
        .buttonStyle(.plain)
    }
}
